import {PROGRAM_END_MESSAGE, PROGRAM_START_MESSAGE, PROGRAM_STATE} from "./popup.js";

const DEFAULT_MESSAGE_FREQUENCY = 15;
const DEFAULT_BLOCKED_TIME = 25;
const DEFAULT_BREAK_TIME = 7;
const CUTE_MESSAGE_ALARM_NAME = "recurringMessages";
const BLOCKED_ALARM_NAME = "blockedAlarm";
const CUTE_MESSAGE_NOTIFICATION_NAME = "cute message";
const BREAK_ALARM_NAME = "breakTime";
const BLOCKED_STATUS = "blocked";
const BLOCKED_ALARM_TIME_STORAGE = "blockedStorage";
const BREAK_ALARM_TIME = "breakTime";
const BREAK_ALARM_TIME_STORAGE = "breakStorage";
const MESSAGE_ARCHIVE = "messageArchive";

const declarativeContent = chrome.declarativeContent;
const alarms = chrome.alarms;
const storage = chrome.storage.sync;
const runtime = chrome.runtime;
const notifications = chrome.notifications;
const urlsToBlock = ["https://*.facebook.com/*", "https://*.twitter.com/*",
    "https://*.instagram.com/*", "https://*.pinterest.com/*", "https://*.reddit.com/*"];
const cuteMessageIdentifier = "cute message:";

let cuteMessageArray;
let cuteMessageLength;
let isBlocked;
let messageToAccess;

export {alarms, storage, runtime, declarativeContent, getRandomIndexToAccess, BLOCKED_ALARM_TIME_STORAGE,
    BREAK_ALARM_TIME_STORAGE, BLOCKED_STATUS, BREAK_ALARM_TIME, cuteMessageIdentifier, MESSAGE_ARCHIVE};

runtime.onInstalled.addListener(function(details) {
    getMessages();
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
    }
});

declarativeContent.onPageChanged.removeRules(undefined, function () {
    declarativeContent.onPageChanged.addRules([{
        conditions: [new declarativeContent.PageStateMatcher()
        ],
        actions: [new declarativeContent.ShowPageAction()]
    }]);
});

function getMessages() {
    let oReq = new XMLHttpRequest();
    oReq.onload = reqListener;
    oReq.open("get", "messages.json", true);
    oReq.send();
}

function reqListener(e) {
    cuteMessageArray = JSON.parse(this.responseText);
    cuteMessageLength = cuteMessageArray.length;
    console.log(cuteMessageLength);
    console.log(cuteMessageArray);
}

chrome.webRequest.onBeforeRequest.addListener(function (details) {
            if (isBlocked) {
                runtime.sendMessage("starting counter");
                return {redirectUrl: chrome.extension.getURL("../Local Pages/blocked.html")};
            }
        },
        {urls: urlsToBlock},
        ["blocking"]);

chrome.storage.onChanged.addListener(function(changes, namespace) {
    console.log(changes);
    if (changes.blocked) {
        isBlocked = changes.blocked.newValue;
        if (isBlocked) {
            removeTabsIfNeeded();
        }
    }
    changeAlarmsIfProgramStarted(changes);
});


function changeAlarmsIfProgramStarted(changes) {
    storage.get(PROGRAM_STATE, function (data) {
        if (data[PROGRAM_STATE]) {
            if (changes.messageFrequency) {
                changeAlarmTime(changes.messageFrequency, CUTE_MESSAGE_ALARM_NAME);
            } else if (changes.blockedTime) {
                changeAlarmTime(changes.blockedTime, BLOCKED_ALARM_NAME);
            } else if (changes.breakTime) {
                changeAlarmTime(changes.breakTime, BREAK_ALARM_NAME);
            }
        }
    });
}

function tryToRemoveTabs() {
    notifications.create(CUTE_MESSAGE_NOTIFICATION_NAME, {
        type: 'basic',
        iconUrl: '../icons/heart.jpg',
        title: 'Warning',
        message: "Unproductive tabs closing in 5 seconds",
        silent: true
    });

    setTimeout(function () {
        notifications.clear('cuteMessage');
        chrome.tabs.query({url: urlsToBlock}, function (tabs) {
            for (let tab of tabs) {
                chrome.tabs.remove(tab.id);
            }});
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
    alarms.create(CUTE_MESSAGE_ALARM_NAME, {
        delayInMinutes: minBetweenMessages,
        periodInMinutes: minBetweenMessages
    });
    printAlarm(CUTE_MESSAGE_ALARM_NAME);
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
        case CUTE_MESSAGE_ALARM_NAME:
            createNotificationCuteMessage();
            break;
        case BLOCKED_ALARM_NAME:
            goToBreak();
            break;
        case BREAK_ALARM_NAME:
            resetBlockAlarm();
            break;
    }
});

function createNotificationCuteMessage() {
    let indexToAccess = getRandomIndexToAccess(cuteMessageLength);
    console.log(indexToAccess);
    messageToAccess = cuteMessageArray[indexToAccess];
    console.log("creating notification");
    runtime.sendMessage("creating message:"+messageToAccess);

    notifications.create(CUTE_MESSAGE_NOTIFICATION_NAME, {
        type: 'basic',
        iconUrl: '../icons/heart.jpg',
        title: 'A message for you',
        message: messageToAccess,
        silent: true,
        requireInteraction: true
    });
    chrome.tabs.query({active: true, url: ["*://*/*"]}, function(tabs) {
        if (tabs.length > 0) {
            chrome.tabs.executeScript(tabs[0].id, {file: 'messageNotification.js'}, function () {
                console.log('injected js');
                chrome.tabs.insertCSS(tabs[0].id, {file: "messageNotification.css"}, function () {
                    console.log('injected css');
                    chrome.tabs.sendMessage(tabs[0].id, messageToAccess);
                });
            });
        } else {
            runtime.sendMessage(cuteMessageIdentifier + messageToAccess);
        }
    });

    storage.get(MESSAGE_ARCHIVE, function(messages) {
        let messageArray = messages[MESSAGE_ARCHIVE];

        if(!messageArray.includes(messageToAccess)) {
            messageArray.push(messageToAccess);
            console.log(messageArray);
            storage.set({[MESSAGE_ARCHIVE]: messageArray});
        }
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
            notifications.create(CUTE_MESSAGE_NOTIFICATION_NAME, {
                type: 'basic',
                iconUrl: 'icons/heart.jpg',
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

    if (name === CUTE_MESSAGE_ALARM_NAME || (name === BLOCKED_ALARM_NAME && isBlocked)
    || (name === BREAK_ALARM_NAME && !isBlocked)) {
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
        case CUTE_MESSAGE_ALARM_NAME:
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