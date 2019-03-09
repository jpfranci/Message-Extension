import {PROGRAM_END_MESSAGE, PROGRAM_START_MESSAGE, PROGRAM_STATE} from "./popup.js";
import {config} from './firebase-config.js';
import {messages} from './default-messages.js';

const DEFAULT_MESSAGE_FREQUENCY = 15;
const DEFAULT_BLOCKED_TIME = 25;
const DEFAULT_BREAK_TIME = 7;

const MESSAGE_ALARM_NAME = "recurringMessages";
const MESSAGE_NOTIFICATION_NAME = "inspiring message";

const BLOCKED_ALARM_NAME = "blockedAlarm";
const BLOCKED_STATUS = "blocked";
const BLOCKED_ALARM_TIME_STORAGE = "blockedStorage";

const BREAK_ALARM_NAME = "breakTime";
const BREAK_ALARM_TIME = "breakTime";
const BREAK_ALARM_TIME_STORAGE = "breakStorage";

const MESSAGE_ARCHIVE = "messageArchive";
const BLOCKED_SITE_STORAGE = 'blockedSites';

const declarativeContent = chrome.declarativeContent;
const alarms = chrome.alarms;
const storage = chrome.storage.sync;
const runtime = chrome.runtime;
const notifications = chrome.notifications;
const messageIdentifier = "message:";

let urlsToBlock = [];
let notificationMessages;
let notificationMessageLength;
let injectedTabs = [];
let isBlocked;
let messageToAccess;

export {alarms, storage, runtime, declarativeContent, getRandomIndexToAccess, BLOCKED_ALARM_TIME_STORAGE,
    BREAK_ALARM_TIME_STORAGE, BLOCKED_STATUS, BREAK_ALARM_TIME, messageIdentifier, MESSAGE_ARCHIVE};

// import from firebase if it exists otherwise use default messages
try {
    firebase.initializeApp(config);
    let database = firebase.firestore();
     // listen to firebase and get anything new
     database.collection("Messages").doc("Test")
     .onSnapshot(function(doc) {
         notificationMessages = doc.data().messages;
         notificationMessageLength = notificationMessages.length;
         console.log(notificationMessages);
     });
} catch(error) {
    notificationMessages = messages;
    notificationMessageLength = messages.length;
    console.log(notificationMessages);
}


runtime.onInstalled.addListener(function(details) {
    if(details.previousVersion == null && details.id == null) {
        storage.set({[PROGRAM_STATE]: false}, function () {
            console.log("success setting programState")
        });
        storage.set({'messageFrequency': DEFAULT_MESSAGE_FREQUENCY}, function () {
            console.log("success setting messageFrequency");
        });
        storage.set({'blockedTime': DEFAULT_BLOCKED_TIME}, function () {
            console.log("success setting blockedTime");
        });
        storage.set({[BREAK_ALARM_TIME]: DEFAULT_BREAK_TIME}, function() {
            console.log("successfully set default break time");
        });
        storage.set({[MESSAGE_ARCHIVE]: []}, function() {
           console.log("successfully set message archive");
        });
        storage.set({[BLOCKED_SITE_STORAGE]: ["*://www.facebook.com/*"]}, () => {
            console.log('set blocked list');
            urlsToBlock = ["*://www.facebook.com/*"];
        })
    }
});

declarativeContent.onPageChanged.removeRules(undefined, function () {
    declarativeContent.onPageChanged.addRules([{
        conditions: [new declarativeContent.PageStateMatcher()
        ],
        actions: [new declarativeContent.ShowPageAction()]
    }]);
});

chrome.tabs.onUpdated.addListener((tabId, changes, tab) => {
    if (isBlocked && changes.url) {
        storage.get([BLOCKED_SITE_STORAGE], (data) => {
            if (data[BLOCKED_SITE_STORAGE].length > 0) {
                chrome.tabs.query({highlighted: true, url: data[BLOCKED_SITE_STORAGE]}, (tabs) => {
                    tabs.forEach((tab) =>{
                        chrome.tabs.update({url: chrome.extension.getURL("../Local Pages/blocked.html")});
                    });
                });
            }
        }); 
    }
});
        
chrome.storage.onChanged.addListener(function(changes, namespace) {
    console.log(changes);
    if (changes.blocked) {
        isBlocked = changes.blocked.newValue;
        if (isBlocked) {
            removeTabsIfNeeded();
        }
    } else if (changes[BLOCKED_SITE_STORAGE]) {
        storage.get([BLOCKED_SITE_STORAGE], (changes) => {
            if(changes[BLOCKED_SITE_STORAGE]) {
                urlsToBlock = changes[BLOCKED_SITE_STORAGE];
            }
        });
    }
    changeAlarmsIfProgramStarted(changes);
});


function changeAlarmsIfProgramStarted(changes) {
    storage.get(PROGRAM_STATE, function (data) {
        if (data[PROGRAM_STATE]) {
            if (changes.messageFrequency) {
                changeAlarmTime(changes.messageFrequency, MESSAGE_ALARM_NAME);
            } else if (changes.blockedTime) {
                changeAlarmTime(changes.blockedTime, BLOCKED_ALARM_NAME);
            } else if (changes.breakTime) {
                changeAlarmTime(changes.breakTime, BREAK_ALARM_NAME);
            }
        }
    });
}

function tryToRemoveTabs() {
    notifications.create(MESSAGE_NOTIFICATION_NAME, {
        type: 'basic',
        iconUrl: '../icons/heart.jpg',
        title: 'Warning',
        message: "Unproductive tabs closing in 5 seconds",
        silent: true
    });

    setTimeout(function () {
        notifications.clear(MESSAGE_NOTIFICATION_NAME);
        if (urlsToBlock.length > 0) {
            chrome.tabs.query({url: urlsToBlock}, (tabs) => {
                for (let tab of tabs) {
                    chrome.tabs.remove(tab.id);
                }});
        }
    }, 5000);
}

function removeTabsIfNeeded() {
    chrome.tabs.query({url: urlsToBlock}, function (tabs) {
        if (tabs.length > 0) {
            tryToRemoveTabs();
        }
    });
}

runtime.onMessage.addListener(function(message) {
    switch(message) {
        case PROGRAM_START_MESSAGE:
            storage.get('messageFrequency', setAlarmMessages);
            storage.get('blockedTime', setAlarmBlockTime);
            break;
        case PROGRAM_END_MESSAGE:
            alarms.clearAll();
            console.log("deleted alarm");
            storage.set({[BLOCKED_STATUS]: false});
            break;
    }
});

function setAlarmMessages(data) {
    let minBetweenMessages = data.messageFrequency;
    alarms.create(MESSAGE_ALARM_NAME, {
        delayInMinutes: minBetweenMessages,
        periodInMinutes: minBetweenMessages
    });
    printAlarm(MESSAGE_ALARM_NAME);
}

function setAlarmBlockTime(data) {
    let minToBlockUntil = data.blockedTime;
    alarms.create(BLOCKED_ALARM_NAME, {
        delayInMinutes: minToBlockUntil,
    });
    printAlarm(BLOCKED_ALARM_NAME);
    setTimeStorageOfAlarm(BLOCKED_ALARM_TIME_STORAGE, minToBlockUntil);
    storage.set({[BLOCKED_STATUS]: true}, function() {
        console.log('successfully set the block');
    });
}

function setTimeStorageOfAlarm(nameOfAlarmTimeInStorage, minToBlockUntil) {
    storage.set({[nameOfAlarmTimeInStorage]: Date.now() + minToMillis(minToBlockUntil)});
}

alarms.onAlarm.addListener(function (alarm) {
    console.log(alarm);
    let name = alarm.name;

    switch(name) {
        case MESSAGE_ALARM_NAME:
            createMessageNotification();
            break;
        case BLOCKED_ALARM_NAME:
            goToBreak();
            break;
        case BREAK_ALARM_NAME:
            resetBlockAlarm();
            break;
    }
});

function createMessageNotification() {
    messageToAccess = notificationMessages[getRandomIndexToAccess(notificationMessageLength)];
    console.log(messageToAccess);

    notifications.create(MESSAGE_NOTIFICATION_NAME, {
        type: 'basic',
        iconUrl: '../icons/heart.jpg',
        title: 'A message for you',
        message: messageToAccess,
        silent: true,
        requireInteraction: true
    });
    chrome.tabs.query({active: true, url: ["*://*/*"]}, function(tabs) {
        if (tabs.length > 0 && !injectedTabs.includes(tabs[0].id)) {
            console.log("creating notification");
            injectedTabs.push(tabs[0].id);
            chrome.tabs.executeScript(tabs[0].id, {file: 'messageNotification.js'}, function () {
                chrome.tabs.insertCSS(tabs[0].id, {file: "messageNotification.css"}, function () {
                    chrome.tabs.sendMessage(tabs[0].id, messageToAccess);
                });
            });
        } else if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, messageToAccess);
        } else {
            runtime.sendMessage(messageIdentifier + messageToAccess);
        }

        storage.get(MESSAGE_ARCHIVE, function(messages) {
            let messageArray = messages[MESSAGE_ARCHIVE];
    
            if(!messageArray.includes(messageToAccess)) {
                messageArray.push(messageToAccess);
                console.log(messageArray);
                storage.set({[MESSAGE_ARCHIVE]: messageArray});
            }
        });
    });
}

function goToBreak() {
    storage.set({[BLOCKED_STATUS]: false}, function () {
        storage.get(BREAK_ALARM_TIME, function(data) {
            let minToGoBreakUntil = data.breakTime;
            alarms.create(BREAK_ALARM_NAME, {
                delayInMinutes: minToGoBreakUntil,
            });
            setTimeStorageOfAlarm(BREAK_ALARM_TIME_STORAGE, minToGoBreakUntil);
            notifications.create(MESSAGE_NOTIFICATION_NAME, {
                type: 'basic',
                iconUrl: '../icons/heart.jpg',
                title: "Time to take a break",
                message: "Take a break, you deserve it",
                silent: true
            });
            printAlarm(BREAK_ALARM_NAME);
        });
    });
}

function resetBlockAlarm() {
    storage.set({[BLOCKED_STATUS]: true}, function () {
        storage.get('blockedTime', setAlarmBlockTime);
    });
}

function changeAlarmTime(timeOfAlarm, alarmName) {
    let oldTime = timeOfAlarm.oldValue;
    let newTime = timeOfAlarm.newValue;

    alarms.get(alarmName, function(alarm) {
        getAlarmData(alarm, oldTime, newTime);
    });
}

function getAlarmData(alarm, oldTime, newTime) {
    let name = alarm.name;
    let whenAlarmWillRingMs = alarm.scheduledTime;

    if (name === MESSAGE_ALARM_NAME || (name === BLOCKED_ALARM_NAME && isBlocked) || 
        (name === BREAK_ALARM_NAME && !isBlocked)) {
        modifyAlarm(newTime, whenAlarmWillRingMs, oldTime, name);
    }
}

function modifyAlarm(newTimeMin, whenAlarmWillRingMs, oldTime, name) {
    let timeToSchedule;
    let timeWithMinuteAdded = Date.now() + minToMillis(1);

    timeToSchedule = whenAlarmWillRingMs - minToMillis(oldTime) + minToMillis(newTimeMin);
    createModifiedAlarm(timeToSchedule, timeWithMinuteAdded, name, newTimeMin);
}

function createModifiedAlarm(timeToSchedule, timeWithMinuteAdded, name, newTimeMin) {
    let timeDifference = (timeToSchedule - Date.now()) / 60000;

    if (timeToSchedule >= timeWithMinuteAdded) {
        createAlarm(name, timeToSchedule, newTimeMin);
        console.log("changed alarm to " + timeDifference + "from now");
    } else {
        createAlarm(name, timeWithMinuteAdded, newTimeMin);
        console.log("changed alarm to minute from now")
    }
    printAlarm(name);
}

function createAlarm(name, timeToSchedule, newTimeInMin) {
    switch(name) {
        case MESSAGE_ALARM_NAME:
            alarms.create(name, {
                when: timeToSchedule,
                periodInMinutes: newTimeInMin
            });
            break;
        case BLOCKED_ALARM_NAME:
            changeAlarmNonRecurring(name, timeToSchedule, BLOCKED_ALARM_TIME_STORAGE);
            break;
        case BREAK_ALARM_NAME:
            changeAlarmNonRecurring(name, timeToSchedule, BREAK_ALARM_TIME_STORAGE);
            break;
    }
}

function changeAlarmNonRecurring(name, timeToSchedule, storageName) {
    alarms.create(name, {when: timeToSchedule});
    storage.set({[storageName]: timeToSchedule});
}

function printAlarm(name) {
    alarms.get(name, function (alarm) {
        console.log(alarm);
    });
}

function minToMillis(num) {
    return num * 60 * 1000;
}

function getRandomIndexToAccess(length) {
    return Math.floor(Math.random() * length);
}