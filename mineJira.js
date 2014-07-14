'use strict';

var async = require('async'),
    util = require('util'),
    https = require('https'),
    parseArgs = require('minimist'),
    fs = require('fs'),
    dust = require ('dustjs-linkedin');
require ('dustjs-helpers');

async.waterfall([
    function (callback) {
        var argv = parseArgs(process.argv.slice(2)),
            configFile,
            resultFile,
            reportName;
        if(!argv.c || argv.c === "") {
            console.log("Config file argument missing. Usage: node mineJira.js -c pathToConfigFile");
            callback("Config file arg missing. Exiting");
        }
        else {
            configFile = require('./' + argv.c);
            callback(null,configFile);
        }
    },
    function (configFile, callback) {
        var jiraProjects = configFile.data,
            index = 0,
            reportObj = {};
        reportObj.issueArray = [];
        reportObj.count = {
            total:0,
            p1:0,
            p2:0,
            p3:0,
            p4:0
        };
        if (index < jiraProjects.length) {
            getIssues(index);
        }
        function getIssues(index) {
            sendRequest(jiraProjects[index].jiraHost, jiraProjects[index].path, jiraProjects[index].auth, function (err, data) {
                if (err) {
                    console.log(err);
                }
                var project = {};
                project.name = jiraProjects[index].projectName;
                project.queryType = jiraProjects[index].title;
                project.issues = [];
                var jsonData = JSON.parse(data);
                var filteringRequired = jiraProjects[index].ooslaFiltering;
                for (var issueIndex in jsonData.issues) {
                    var issue = jsonData.issues[issueIndex];
                    var issueObj = {
                        key: issue.key,
                        url: 'https://' + jiraProjects[index].jiraHost + '/browse/' + issue.key,
                        summary: issue.fields.summary,
                        status: issue.fields.status.name,
                        priority: issue.fields.priority.name,
                        reporter: issue.fields.reporter.name,
                        assignee: issue.fields.assignee && issue.fields.assignee.name,
                        dateCreated: issue.fields.created,
                        dateUpdated: issue.fields.updated.split("T")[0],
                        oosla: true
                    };
                    if(issueObj.priority === "Blocker" || issueObj.priority === "P1") {
                        reportObj.count.p1++;
                    }
                    else if(issueObj.priority === "Critical" || issueObj.priority === "P2") {
                        reportObj.count.p2++;
                    }
                    else if(issueObj.priority === "Major" || issueObj.priority === "Normal" || issueObj.priority === "P3") {
                        reportObj.count.p3++;
                    }
                    else {
                        reportObj.count.p4++;
                    }
                    reportObj.count.total++;
                    if (filteringRequired) {

                        var unixCreatedTime = Date.parse(issueObj.dateCreated);
                        var unixCurrentTime = Date.now();
                        var sla = jiraProjects[index].ooslaFiltering.criteria[issueObj.priority];
                        if (((unixCurrentTime - unixCreatedTime)/24/60/60/1000) <= sla) {
                            issueObj.oosla = false;
                        }
                    }
                    project.issues.push(issueObj);
                }
                if(project.issues.length > 0) {
                    project.totalIssues = project.issues.length; 
                    reportObj.issueArray.push(project);
                }
                index++;
                if (index < jiraProjects.length) {
                    getIssues(index);
                }
                else {
                    reportObj.generatedTime = new Date();
                    callback(null, reportObj, configFile);
                }
            });
        }
    },
    function (reportObj, configFile, callback) {
        var reportConfig = configFile.generateReport;
        var output = "";
        if(reportConfig) {
            var tmpl = fs.readFileSync('./'+reportConfig.dustTemplate, 'utf8'),
                compiled = dust.compile(tmpl, "issueTmpl");
            dust.loadSource(compiled);
            if(reportConfig.templateData) {
                reportObj.templateData = reportConfig.templateData;
            }
            dust.render("issueTmpl", reportObj, function(err, out) {
                if(err) {
                    console.log(err);
                }
                output = out;
                if(reportConfig.reportName) {
                    fs.writeFile('reports/'+reportConfig.reportName, output, function (err) {
                        if (err) { throw err; }
                        console.log("Report saved under reports/"+reportConfig.reportName);
                        callback(null, reportObj, configFile, output);   
                    });
                }
                else {
                    console.log(output);
                    callback(null, reportObj, configFile, output);   
                }
                

            });
        }
        else {
            callback(null, reportObj, configFile, output);
        }
    },
    function (reportObj, configFile, emailBody, callback) {
        var emailConfig = configFile.sendEmail;
        if(emailConfig) {
            var emailExtension = emailConfig.emailExtension,
                filterArray = ["reporters", "assignees"],
                emailFilter = emailConfig.toEmailFilter,
                ccFilter = emailConfig.ccEmailFilter;
            if(filterArray.indexOf(emailFilter)!== -1 || filterArray.indexOf(ccFilter) !== -1) {
                for(var projectIndex in reportObj.issueArray) {
                    for (var issueIndex in reportObj.issueArray[projectIndex].issues) {
                        var reporter = reportObj.issueArray[projectIndex].issues[issueIndex].reporter,
                            assignee = reportObj.issueArray[projectIndex].issues[issueIndex].assignee,
                            emailRecipients = emailConfig.toEmail,
                            ccRecipients = emailConfig.ccEmail; 
                        if(emailFilter === "reporters") {
                            if(emailRecipients.indexOf(reporter) === -1) {
                                emailRecipients.push(reporter);
                            }
                        }
                        if(emailFilter === "assignees") {
                            if(emailRecipients.indexOf(assignee) === -1) {
                                emailRecipients.push(assignee);
                            }
                        }
                        if(ccFilter === "reporters") {
                            if(ccRecipients.indexOf(reporter) === -1) {
                                ccRecipients.push(reporter);
                            }
                        }
                        if(ccFilter === "assignees") {
                            if(ccRecipients.indexOf(assignee) === -1) {
                                ccRecipients.push(assignee);
                            }
                        }
                    }
                }
                generateRecipients(emailConfig.toEmail, emailExtension, function (err, array) {
                    emailConfig.toEmail = array;
                    generateRecipients(emailConfig.ccEmail, emailExtension, function (err, array) {
                        emailConfig.ccEmail = array;
                    });
                });
            }
            else {
                generateRecipients(emailConfig.toEmail, emailExtension, function (err, array) {
                    emailConfig.toEmail = array;
                    generateRecipients(emailConfig.ccEmail, emailExtension, function (err, array) {
                        emailConfig.ccEmail = array;
                    });
                });   
            }      
            if(emailConfig.addDateToSubject) {
                emailConfig.subject += " " + reportObj.generatedTime;
            }
            console.log("From email is " + emailConfig.fromEmail);
            console.log("To email is " + emailConfig.toEmail);
            console.log("CC email is " + emailConfig.ccEmail);
            console.log("Subject is " + emailConfig.subject);
            var nodemailer = require("nodemailer");
            var transport = nodemailer.createTransport("sendmail", {
                path: "/usr/sbin/sendmail"
            });
            var mailOptions = {
                from: emailConfig.fromEmail,
                to: emailConfig.toEmail,
                cc: emailConfig.ccEmail,
                subject: emailConfig.subject,
                html: emailBody
            };
            if(!emailBody) {
                console.log("Email body is empty, not sending email");
            } else if(process.platform === 'win32') {
                console.log("Send mail feature only works on Unix based OS. Not sending email");
            }
            else {
                console.log("Sending email");
                transport.sendMail(mailOptions);
                transport.close();
            }
            callback(null,'done');
        }
        else {
            console.log("Not sending email");
            callback(null,'done');
        }  
    }
],
function (err, result) {
    if(err) {
        console.log(err);
    }
    else {
        console.log(result);
    }
});

function sendRequest(hostname, path, auth, callback) {
    var options = {
        hostname: hostname,
        port: 443,
        path: path,
        rejectUnauthorized: false,
        method: 'GET',
        auth: auth
    };

    console.log("URL is " + options.hostname + options.path);
    var req = https.request(options, function (res) {
        var responseData = "";
        res.on('data', function (d) {
            responseData = responseData + d;
        });
        res.on('end', function () {
            callback(null, responseData);
        });
    });
    req.end();
    req.on('error', function (e) {
        console.error("Encoutered error condition" + e);
    });
}

function generateRecipients(array, emailExtension, callback) {
    if(array.length >= 1) {
        if(array.length === 1) {
            array = array.toString().concat(emailExtension);
        }
        else {
            array = array.join(emailExtension+',').concat(emailExtension);
        }
    }
    callback(null, array);
}