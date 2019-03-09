import {BREAK_ALARM_OPTION, displayNotificationInCurrentTab, 
    createMessageNotification, BLOCKED_STATUS, getIsBlocked, createDesktopNotification} from "./bgd.js";
import {PROGRAM_STATE, PROGRAM_START_MESSAGE, PROGRAM_END_MESSAGE} from "./popup.js";

const MESSAGE_ALARM_NAME = "recurringMessages";
const MESSAGE_ALARM_OPTION = "messageFrequency";

const BLOCKED_ALARM_NAME = "blockedAlarm";
const BLOCKED_ALARM_TIME_STORAGE = "blockedStorage";
const BLOCKED_ALARM_OPTION = "blockedTime";

const BREAK_ALARM_NAME = "breakTime";
const BREAK_ALARM_TIME_STORAGE = "breakStorage";

const alarms = chrome.alarms;
const storage = chrome.storage.sync;
const runtime = chrome.runtime;

// Listens for when the program starts, which prompts program to start timers and when it ends 
// which is when it deletes all alarms
runtime.onMessage.addListener(function(message) {
    switch(message) {
        case PROGRAM_START_MESSAGE:
            storage.get(MESSAGE_ALARM_OPTION, setAlarmMotivationalMessages);
            storage.get(BLOCKED_ALARM_OPTION, setAlarmBlockTime);
            break;
        case PROGRAM_END_MESSAGE:
            alarms.clearAll();
            break;
    }
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[MESSAGE_ALARM_OPTION] || changes[BLOCKED_ALARM_OPTION] || changes[BREAK_ALARM_OPTION])
        changeAlarmsIfProgramStarted(changes);
 });
 
 function changeAlarmsIfProgramStarted(changes) {
     storage.get(PROGRAM_STATE, function (data) {
         if (data[PROGRAM_STATE]) {
             if (changes[MESSAGE_ALARM_OPTION]) {
                 changeAlarmTime(changes[MESSAGE_ALARM_OPTION], MESSAGE_ALARM_NAME);
             } else if (changes[BLOCKED_ALARM_OPTION]) {
                 changeAlarmTime(changes[BLOCKED_ALARM_OPTION], BLOCKED_ALARM_NAME);
             } else if (changes[BREAK_ALARM_OPTION]) {
                 changeAlarmTime(changes[BREAK_ALARM_OPTION], BREAK_ALARM_NAME);
             }
         }
     });
 }
 
 function changeAlarmTime(timeOfAlarm, alarmName) {
     let oldTime = timeOfAlarm.oldValue;
     let newTime = timeOfAlarm.newValue;
     alarms.get(alarmName, function(alarm) {
         if (alarm) {
             getAlarmData(alarm, oldTime, newTime);
         }
     });
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

function setAlarmMotivationalMessages(data) {
    let minBetweenMessages = data[MESSAGE_ALARM_OPTION];
    alarms.create(MESSAGE_ALARM_NAME, {
        delayInMinutes: minBetweenMessages,
        periodInMinutes: minBetweenMessages
    });
    printAlarm(MESSAGE_ALARM_NAME);
}

function setAlarmBlockTime(data) {
    let minToBlockUntil = data[BLOCKED_ALARM_OPTION];
    alarms.create(BLOCKED_ALARM_NAME, {
        delayInMinutes: minToBlockUntil,
    });
    printAlarm(BLOCKED_ALARM_NAME);
    setTimeStorageOfAlarm(BLOCKED_ALARM_TIME_STORAGE, minToBlockUntil);
    storage.set({[BLOCKED_STATUS]: true});
}

function setTimeStorageOfAlarm(nameOfAlarmTimeInStorage, minToBlockUntil) {
    storage.set({[nameOfAlarmTimeInStorage]: Date.now() + minToMillis(minToBlockUntil)});
}

function goToBreak() {
    storage.set({[BLOCKED_STATUS]: false}, function () {
        storage.get(BREAK_ALARM_OPTION, function(data) {
            let minToGoBreakUntil = data[BREAK_ALARM_OPTION];
            alarms.create(BREAK_ALARM_NAME, {
                delayInMinutes: minToGoBreakUntil,
            });
            setTimeStorageOfAlarm(BREAK_ALARM_TIME_STORAGE, minToGoBreakUntil);
            displayNotificationInCurrentTab("Time to take a break", () => {
                createDesktopNotification("Time to take a break", "Keep up the good work!");
            });
            printAlarm(BREAK_ALARM_NAME);
        });
    });
}

function resetBlockAlarm() {
    const messageToDisplay = "Your break is ending in one minute. Please close all your work in blocked tabs";
    displayNotificationInCurrentTab(messageToDisplay, () => {
        createDesktopNotification(messageToDisplay, "Warning")
    });

    setTimeout(() => {
        storage.get(PROGRAM_STATE, data => {
            if (data[PROGRAM_STATE]) {
                storage.set({[BLOCKED_STATUS]: true}, () => {
                    storage.get(BLOCKED_ALARM_OPTION, setAlarmBlockTime);
                });
            }
        })
    }, minToMillis(1));
}



function getAlarmData(alarm, oldTime, newTime) {
    let name = alarm.name;
    let whenAlarmWillRingMs = alarm.scheduledTime;

    if (name === MESSAGE_ALARM_NAME || (name === BLOCKED_ALARM_NAME && getIsBlocked()) || 
        (name === BREAK_ALARM_NAME && !getIsBlocked())) {
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
