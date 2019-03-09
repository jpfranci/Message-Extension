import {PROGRAM_END_MESSAGE, PROGRAM_START_MESSAGE, PROGRAM_STATE} from "./popup.js";
import {config} from './firebase-config.js';
import {defaultMessages} from './default-messages.js';

const DEFAULT_MESSAGE_FREQUENCY = 15;
const DEFAULT_BLOCKED_TIME = 25;
const DEFAULT_BREAK_TIME = 7;

const BLOCKED_ALARM_TIME_STORAGE = "blockedStorage";
const BREAK_ALARM_TIME_STORAGE = "breakStorage";

/* These are keys for local storage that represent the program state
* BLOCKED_STATUS is the key for a boolean representing whether the user is currently blocked or not
* MESSAGE_ARCHIVE is the key for an array of all of the messages that the user has encountered so far 
* BLOCKED_SITE_STORAGE is the key an array of all of the user's whitelisted sites in regex
* BREAK_ALARM_OPTION is the key for the current length of break time as entered by the user
*/
const BLOCKED_STATUS = "blocked";
const MESSAGE_ARCHIVE = "messageArchive";
const BLOCKED_SITE_STORAGE = 'blockedSites';
const BREAK_ALARM_OPTION = "breakTime";

// a bunch of chrome shortcuts
const declarativeContent = chrome.declarativeContent;
const alarms = chrome.alarms;
const storage = chrome.storage.sync;
const runtime = chrome.runtime;
const notifications = chrome.notifications;

// identifiers for notifications
const MESSAGE_NOTIFICATION_NAME = "inspiring message";
const messageIdentifier = "message:";

/* These are global variables to help so there's no need to deal with local storage for everything
* urlsToBlock are the user's whitelisted sites
* notificationMessages are the pool of messages for motivational messages
* injectedTabs is an array containing all of the chrome tabs in the current session that have 
* been injected with the in browser notification box script
* isBlocked is a boolean representing whether sites are blocked or not
*/
let urlsToBlock = [];
let notificationMessages = [];
let injectedTabs = [];
let isBlocked = false;

export {
    alarms, storage, runtime, 
    declarativeContent, getRandomIndexToAccess, 
    BLOCKED_ALARM_TIME_STORAGE, BREAK_ALARM_TIME_STORAGE, 
    BLOCKED_STATUS, BREAK_ALARM_OPTION, messageIdentifier, MESSAGE_ARCHIVE,
    getIsBlocked, displayNotificationInCurrentTab, createMessageNotification,
    createDesktopNotification,
};

// import from firebase if it exists otherwise use default messages
try {
    firebase.initializeApp(config);
    let database = firebase.firestore();
     // listen to firebase and get anything new
     database.collection("Messages").doc("Test")
     .onSnapshot(function(doc) {
         filterAlreadyUsedMessages(doc.data().messages);
     });
} catch(error) {
    filterAlreadyUsedMessages(defaultMessages);
}

function filterAlreadyUsedMessages(tempMessages) {
    storage.get([MESSAGE_ARCHIVE], (data) => {
        if (!data[MESSAGE_ARCHIVE]) {
            notificationMessages = tempMessages;
        } else {
            notificationMessages = tempMessages.filter(message => {
                return !data[MESSAGE_ARCHIVE].includes(message);
            });
        }
    })
}

/* Sets state of this chrome extension on install.
*  Program state is initially false, options for alarm frequencies are set to default values,
*  the message archive is set to an empty array and facebook is initially set to be blocked
*/
runtime.onInstalled.addListener(function(details) {   
    if(!details.previousVersion && !details.id) {
        storage.set({[PROGRAM_STATE]: false});
        storage.set({'messageFrequency': DEFAULT_MESSAGE_FREQUENCY});
        storage.set({'blockedTime': DEFAULT_BLOCKED_TIME});
        storage.set({[BREAK_ALARM_OPTION]: DEFAULT_BREAK_TIME});
        storage.set({[MESSAGE_ARCHIVE]: []});
        storage.set({[BLOCKED_SITE_STORAGE]: ["*://www.facebook.com/*"]}, () => {
            urlsToBlock = ["*://www.facebook.com/*"];
        })
    }
});

function getIsBlocked() {
    return isBlocked;
}

runtime.onMessage.addListener(function(message) {
    switch(message) {
        case PROGRAM_END_MESSAGE:
            injectedTabs = [];
            storage.set({[BLOCKED_STATUS]: false});
            break;
    }
});

// shows the popup on extension button click
declarativeContent.onPageChanged.removeRules(undefined, function () {
    declarativeContent.onPageChanged.addRules([{
        conditions: [new declarativeContent.PageStateMatcher()
        ],
        actions: [new declarativeContent.ShowPageAction()]
    }]);
});

// Blocks a site when if it matches any of the sites on the user's whitelist
chrome.tabs.onUpdated.addListener((tabId, changes, tab) => {
    if (isBlocked && changes.url) {
        storage.get([BLOCKED_SITE_STORAGE], (data) => {
            if (data[BLOCKED_SITE_STORAGE].length > 0) {
                chrome.tabs.query({highlighted: true, url: data[BLOCKED_SITE_STORAGE]}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.update({url: chrome.extension.getURL("../Local Pages/blocked.html")});
                    });
                });
            }
        }); 
    }
});

/* Removes whitelisted urls from tabs that are blocked when program is turned on or 
*  updates the urlsToBlock(list of whitelisted sites) if it updated or
*  changes the current alarms if any options are updated
*/
chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[BLOCKED_STATUS]) {
        isBlocked = changes[BLOCKED_STATUS].newValue;
        if (isBlocked) {
            removeTabsIfNeeded();
        }
    } else if (changes[BLOCKED_SITE_STORAGE]) {
        storage.get([BLOCKED_SITE_STORAGE], (changes) => {
            if(changes[BLOCKED_SITE_STORAGE]) {
                urlsToBlock = changes[BLOCKED_SITE_STORAGE];
                storage.get(BLOCKED_STATUS, (data) => {
                    if (data[BLOCKED_STATUS]) {
                        clearBlockedSites();
                    }
                });
            }
        });
    }
});

function createDesktopNotification(messageToDisplay, title){
    const header = title ? title : "A message for you";
    notifications.create(MESSAGE_NOTIFICATION_NAME, {
        type: 'basic',
        iconUrl: '../icons/heart.jpg',
        title: header,
        message: messageToDisplay,
        silent: true,
        requireInteraction: true
    });
}

function tryToRemoveTabs() {
    createDesktopNotification("Unproductive tabs closing in 5 seconds", "Warning");

    setTimeout(function () {
        notifications.clear(MESSAGE_NOTIFICATION_NAME);
        clearBlockedSites();
    }, 5000);
}

function clearBlockedSites() {
    if (urlsToBlock.length > 0) {
        chrome.tabs.query({url: urlsToBlock}, (tabs) => {
            tabs.forEach(tab => chrome.tabs.remove(tab.id));
        });
    }
}

function removeTabsIfNeeded() {
    storage.get(BLOCKED_SITE_STORAGE, (data) => {
        if (data[BLOCKED_SITE_STORAGE]) {
            urlsToBlock = data[BLOCKED_SITE_STORAGE];
            chrome.tabs.query({url: data[BLOCKED_SITE_STORAGE]}, function (tabs) {
                if (tabs.length > 0) {
                    tryToRemoveTabs();
                }
            });
        }
    });
}

function createMessageNotification() {
    let randomIndex = getRandomIndexToAccess(notificationMessages.length);
    let messageToAccess = notificationMessages[randomIndex];
    displayNotificationInCurrentTab(messageToAccess, () => { 
        createDesktopNotification(messageToAccess);
    });

    storage.get(MESSAGE_ARCHIVE, function(messages) {
        let messageArray = messages[MESSAGE_ARCHIVE];
        if(!messageArray.includes(messageToAccess)) {
            messageArray.push(messageToAccess);
            storage.set({[MESSAGE_ARCHIVE]: messageArray});
        }
    });

    notificationMessages.splice(randomIndex, 1);
}

// Displays messageToAccess in current tab
// executes onChromeNotFocused if the chrome window is not focused as well
function displayNotificationInCurrentTab(messageToAccess, onChromeNotFocused) {
    chrome.windows.getCurrent(window => {
        // If the chrome window is not the active window then call the onChromeNotFocused callback
        if (!window || !window.focused) {
            onChromeNotFocused();
        } 
        
        else {
            const tabNotificationQuery = {currentWindow: true, highlighted: true, url: ["*://*/*"]};
            chrome.tabs.query(tabNotificationQuery, function(tabs) {
                /* injects message notifying scripts and css to page if not already injected 
                * and sends the message to current tab to display */
                if (tabs.length > 0 && !injectedTabs.includes(tabs[0].id)) {
                    injectedTabs.push(tabs[0].id);
                    chrome.tabs.executeScript(tabs[0].id, {file: 'messageNotification.js'}, function () {
                        chrome.tabs.insertCSS(tabs[0].id, {file: "messageNotification.css"}, function () {
                            chrome.tabs.sendMessage(tabs[0].id, messageToAccess);
                        });
                    });
                // sends the message to the current tab to display  
                } else if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, messageToAccess);
                // if no valid url then sends message to local extension pages in case that it is their 
                // active tab
                } else {
                    runtime.sendMessage(messageIdentifier + messageToAccess);
                }
            });
        }
    });
}

function getRandomIndexToAccess(length) {
    return Math.floor(Math.random() * length);
}