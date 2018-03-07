function doGet(e) {
  Logger.log("parameters %s", e.paramter);
  if (!e.parameter.what || e.parameter.what === "show")
  {
    return HtmlService.createTemplateFromFile('show').evaluate();
  }
  else if (e.parameter.what === "signup")
  {
    var courseCode = e.parameter.CourseCode;
    var classID    = e.parameter.ClassID;
  
    var t = HtmlService.createTemplateFromFile('signup');
    t.courseCode = courseCode;
    t.classID    = classID;  
    return t.evaluate();
  }
}

function processForm(formObject) {
  var courseCode  = formObject.courseCode;
  var classID     = formObject.classID;
  var studentName = formObject.studentName;
  var parentName  = formObject.parentName;
  var email       = formObject.email;
  var phone       = formObject.phone;
  
  var returnData = "Form successfully submitted! You can close this window now."
  
  var id = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetname = courseCode + "_Enrollments";
  var sheet = SpreadsheetApp.openById(id).getSheetByName(sheetname);
  if ( sheet === null )
  {
    return "Error! Course is not found!";
  }
  
  var enrollmentID = Utilities.getUuid();
  
  var newRow = [classID, enrollmentID, parentName, email, phone, studentName, 'No'];
  
  sheet.appendRow(newRow);
  
  sendEmailConfirmation(courseCode, classID, email, parentName, studentName, enrollmentID);
  
  return returnData;
}

function sendEmailConfirmation(courseCode, classID, email, parentName, studentName, enrollmentID)
{
  var cls = getClassByCourseCodeAndClassID(courseCode, classID);

  var cal = ics();
  var calSubject = "Booming Minds class for " + studentName;
  var calDescription = courseCode + " - " + cls.CourseName;
  var calLocation    = cls.Location;
  var calBegin       = cls.Date + " " + cls.TimeBegin;
  var calEnd         = cls.Date + " " + cls.TimeEnd;
  cal.addEvent(calSubject, calDescription, calLocation, calBegin, calEnd);
  
  var blob = Utilities.newBlob(cal.build(), 'text/x-vCalendar', 'Booming_Minds_Class.ics');
  var mailSubject = "Booming Minds class sign-up confirmation";
  var mailBody    = "<p>Hello " + parentName + ",</p>";
  mailBody       += "<p>Thank you for signing up for one of our Booming Minds classes. Below is the class detail:</p>";
  mailBody       += "<pre>Course Name  : " + courseCode + " - " + cls.CourseName + "</pre>";
  mailBody       += "<pre>Date         : " + cls.Date + "</pre>";
  mailBody       += "<pre>Time         : " + cls.TimeBegin + " - " + cls.TimeEnd + "</pre>";
  mailBody       += "<pre>Location     : " + cls.Location + "</pre>";
  mailBody       += "<pre>Student      : " + studentName + "</pre>";
  mailBody       += "<pre>Enrollment ID: " + enrollmentID + "</pre>";
  mailBody       += "<p>We've also attached an iCal event file which can be easily imported into your calendar.</p>"
  mailBody       += "<p>See you in class!</p>"
  MailApp.sendEmail({
    to      : email,
    subject : mailSubject,
    htmlBody: mailBody,
    attachments : [blob]
  });
}

function getScriptUrl() {
 var url = ScriptApp.getService().getUrl();
 return url;
}

function getCourses()
{
  var id = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetname = "Courses";
  var data = SpreadsheetApp.openById(id).getSheetByName(sheetname).getDataRange().getValues();
  var returnData = [];
  
  data.forEach(function(f)
               {
                 if (f[0] === "CourseCode")
                   return;
                 var c = {"CourseCode" : f[0], "CourseName" : f[1]};
                 returnData.push(c);
               });
  Logger.log("getCourses() returns %s", returnData);
  return returnData;
}

function getAllClasses()
{
  Logger.log("getAllClasses()");
  var id = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetname = "Courses";
  var data = SpreadsheetApp.openById(id).getSheetByName(sheetname).getDataRange().getValues();
  var returnData = [];
  
  data.forEach(function(f)
               {
                 if (f[0] === "CourseCode")
                   return;
                 var courseCode = f[0];
                 returnData.push.apply(returnData, getClassesForCourse(courseCode));
               });
  Logger.log("  %s", JSON.stringify(returnData));
  return returnData;
}

/*
An Class object looks like this:
[{"ClassID":"xxx", "CourseCode":"123", "Location":"abc", "Date":"yyy", "TimeBegin":"zzz", "TimeEnd":"zzz", "Enrollments":[{"ParentName":"ppp", ...}, {"ParentName":"qqq", ...}]}
*/
function getClassesForCourse(courseCode)
{
  Logger.log("getClassesForCourse(%s)", courseCode);
  var id = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetname = courseCode;
  var sheet = SpreadsheetApp.openById(id).getSheetByName(sheetname);
  if (sheet === null)
    return [];
  var courseData = sheet.getDataRange().getValues();
  
  var enrollmentData = getEnrollmentsByCourseCode(courseCode);
  Logger.log(" enrollments: %s", enrollmentData);
  
  var returnData = [];
  courseData.forEach(function (f)
                     {
                       if (f[0] === "ClassID")
                         return;
                       var classID  = f[0];
                       var location = f[1];
                       var date     = f[2].toDateString();
                       var timeBegin= f[3].toLocaleTimeString();
                       var timeEnd  = f[4].toLocaleTimeString();
                       var enrolled = enrollmentData.filter(function (el){return el.ClassID===classID}); 
                       var cls = {"ClassID" : classID, "CourseCode": courseCode, "Location":location, 
                                  "Date":date, "TimeBegin":timeBegin, "TimeEnd":timeEnd, 
                                  "NumEnrolled": enrolled.length};
                       returnData.push(cls);
                     });
  return returnData;
}

function getEnrollmentsByCourseCode(courseCode)
{
  Logger.log(" getEnrollmentsByCourseCode %s", courseCode);
  var id = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetname = courseCode + "_Enrollments";
  var sheet = SpreadsheetApp.openById(id).getSheetByName(sheetname);
  if (sheet === null)
    return [];
  
  var enrollmentData = sheet.getDataRange().getValues();
  
  var returnData = [];
  
  enrollmentData.forEach(function(f)
                         {
                           if (f[0] === "ClassID")
                             return;
                           var classID      = f[0];
                           var enrollmentID = f[1];
                           var parentName   = f[2];
                           var email        = f[3];
                           var phone        = f[4];
                           var studentName  = f[5];
                           var isConfirmed  = f[6];
                           var enr = {"ClassID": classID, "EnrollmentID": enrollmentID, "CourseCode": courseCode,
                                      "ParentName": parentName, "Email": email,
                                      "Phone": phone, "StudentName": studentName,
                                      "isConfirmed": isConfirmed};
                           returnData.push(enr);
                         });
  
  return returnData;
}

function getCourseByCourseCode(courseCode)
{
  var sheetID = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetName = "Courses";
  var data = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName).getDataRange().getValues();
  var returnData = {};
  
  for (var i = 1; i < data.length; ++i)
  {
    var rowData = data[i];
    if (rowData[0] === courseCode)
    {
      returnData = {"CourseCode": courseCode, "CourseName": rowData[1]};
      break;
    }
  }
  
  return returnData;
}

function getClassByCourseCodeAndClassID(courseCode, classID)
{
  Logger.log(" get %s, %s", courseCode, classID);
  var sheetID = PropertiesService.getScriptProperties().getProperty('BMSS_SHEET_ID');
  var sheetName = courseCode;
  Logger.log(" sheet %s, %s", sheetID, sheetName);
  var sheet = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName);
  var returnData = {};
  
  if (sheet === null)
  {
    Logger.log("sheet is null");
    return returnData;
  }

  var courseData = getCourseByCourseCode(courseCode);
  if (courseData === {})
  {
    Logger.log("courseData is null");
    return returnData;
  }
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; ++i)
  {
    var rowData = data[i];
    if (rowData[0] === classID)
    {
      location = rowData[1];
      date     = rowData[2].toDateString();
      timeBegin= rowData[3].toLocaleTimeString();
      timeEnd  = rowData[4].toLocaleTimeString();
      returnData = {"CourseCode": courseCode, "CourseName": courseData.CourseName, "ClassID": classID, 
                    "Date": date, "TimeBegin": timeBegin, "TimeEnd": timeEnd, 
                    "Location": location};
      break;
    }
  }
  
  Logger.log(" return %s", returnData);
  return returnData;
}