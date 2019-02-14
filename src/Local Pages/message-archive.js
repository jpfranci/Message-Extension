import {storage, MESSAGE_ARCHIVE} from "../Background/bgd.js";

let numMessages = 1;
let isRemoved = false;

function createListEntry(message) {
    let newMessageEntry = document.createElement("li");
    let messageText = document.createElement("p");
    messageText.innerText = message;
    let span = document.createElement("span");
    span.innerText = numMessages.toString() + ".";
    newMessageEntry.appendChild(span);
    newMessageEntry.appendChild(messageText);
    messageText.className = "message-archive";
    document.getElementById("messageListId").appendChild(newMessageEntry);
    numMessages++;
}

storage.get(MESSAGE_ARCHIVE, function(data) {
    let messages = data[MESSAGE_ARCHIVE];
    if (messages.length > 0) {
        document.getElementById("noMessages").remove();
        isRemoved = true;
        messages.forEach(message => {
            createListEntry(message);
        });
    }
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes[MESSAGE_ARCHIVE]) {
        if(!isRemoved) {
            document.getElementById("noMessages").remove();
        }
        isRemoved = true;
        let newMessage = changes[MESSAGE_ARCHIVE].newValue.pop();
        createListEntry(newMessage);
    }
});