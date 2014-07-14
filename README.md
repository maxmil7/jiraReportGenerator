jiraReportGenerator
===================
* [General Info](#info)
* [How do I generate a report?](#process)
* [Configuration file](#config)
* [Sample report](#report)
* [Node.js and Dust.js reading docs](#docs)  
* [Limitations](#limitations)

<a name="info"></a>This repository contains scripts to fetch data from multiple instances of JIRA, consolidate it and display it in a report. Optionally, the report can be automatically emailed. The scripts are written in [Node.js](http://nodejs.org) and [Dust.js](http://linkedin.github.io/dustjs/) is used as the templating language for the reports.

The configuration for the report is driven by a JSON file which contains information like which JIRA instance to connect to, which query to use, who to send email to etc. A sample configuration file can be found [here](config/sample.json).



##<a name="process"></a>How do I generate a report? 

* Install [Node.js](http://nodejs.org) then run the following command
 <p><pre>git clone https://github.com/maxmil7/jiraReportGenerator.git
cd jiraReportGenerator
npm install</pre></p>
* Go to config/sample.json and replace "toUsername" and "ccUsername" with the username of the person to email the report to.
* Replace "emailExtension" with your email extension (Email will be sent to **username** @ **emailExtension**)
* Run the following command
<p><pre>node mineJira.js -c config/sample.json</p></pre>
* You should get an email containing open issues from public jira instances of Spring.net and CodeHaus. The report should also get saved under the reports folder. Currently email report feature does not work for Windows OS. Please refer to limitations.

##<a name="config"></a>Configuration file 
The configuration file contains the following options which can be used to generate different kinds of reports:
<pre>
{
    "data": [ //Array containing configuration objects for different projects
        {
            "projectName": "SPRNETSOCIALDB", //Name of the project
            "title": "Spring.NET Social Dropbox open issues", //Description of the issues being filtered
            "jiraHost": "jira.spring.io", //FQDN of the JIRA instance
            "path": "/rest/api/latest/search?jql=project%20in%20(\"Spring.NET%20Social%20Dropbox\")%20AND%20type%20%3D%20Bug", //JIRA REST query for filtering bugs
            "auth": null, //Auth credentials if the JIRA instace requires authentication for displaying issues. Format should be "username:password"
            "ooslaFiltering": { //Criteria for highlighting bugs as OOSLA (out of sla). Can be set to "null" if OOSLA highlighting is not required.
                "criteria": {
                "Blocker": "1.5",
                "Major": "3",
                "Critical": "3",
                "Normal": "5",
                "Minor": "200"
            }
        }
    ],
    "generateReport": {
        "dustTemplate": "templates/report.dust", //Location of dust template to use to generate the report
        "templateData": { //Template specific data
            "reportTitle": "JIRA consolidated bug report" 
        },
        "reportName": "report.html" //Name of the generated report file. Can be set to "null" if you don't want to save the report.
    },
    "sendEmail": { //Email information. Can be set to "null" if you don't want to email the report.
        "fromEmail": "JIRA defect tracker <DefectTracker@paypal.com>", //From email address
        "toEmail": [ //Array containing usernames of people to email the report to.
            "toUsername" 
        ],
        "toEmailFilter": null, //Can be set to "reporters" or "assignees". Report will be sent to the reporters or assignees of the issues in addition to the poeple specified in the "toEmail"
        "ccEmail": [ //Array containing usernames of people to be CC'ed
            "ccUsername"
        ],
        "ccEmailFilter": null, //Works the same as toEmailFilter however people are in CC instead of To
        "emailExtension": "@example.com", //Email extension. Will be appended to the username
        "subject": "Daily JIRA bug report", //Subject of the email
        "addDateToSubject": true //Add date and time of report in the subject
    }
}
</pre>


##<a name="report"></a>Sample report
A sample report for Sprint.NET and CodeHaus project can be found [here.](reports/sample_report.html)
##<a name="docs"></a>Node.js and Dust.js reading docs
* [NodeJS beginner guide](http://nodeguide.com/beginner.html)
* [DustJS](http://linkedin.github.io/dustjs/)
* [Realtime DUST template editor](http://linkedin.github.io/dustjs/test/test.html)

##<a name="limitations"></a>Limitations
* Email feature requires 'sendmail' utility installed under /usr/sbin/sendmail. Hence it does not support WINDOWS OS currently.
