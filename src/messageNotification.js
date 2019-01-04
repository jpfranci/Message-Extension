function showNotification(message) {
    let montserratFontFace = new FontFace('Montserrat', 'url(https://fonts.gstatic.com/s/' +
        'montserrat/v12/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2)');
    document.fonts.add(montserratFontFace);

    let newMessage = document.createElement("div");
    newMessage.className = "fancy-box-inject";
    newMessage.id = "injectedScript";

    let messageTextHeader = document.createElement("h2");
    messageTextHeader.className = 'header-message';
    messageTextHeader.innerText = "A message for the bae";
    newMessage.appendChild(messageTextHeader);

    let messageText = document.createElement("h2");
    messageText.className = "fancy-heading-inject";
    messageText.innerText = message;
    newMessage.appendChild(messageText);

    document.body.insertBefore(newMessage, document.body.firstChild);

    newMessage.addEventListener("click", function () {
        newMessage.remove();
    });

    setTimeout(function () {
        newMessage.remove();
    }, 12000);
}

chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {
    showNotification(message);
});
