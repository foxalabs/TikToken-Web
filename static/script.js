showdown.extension('katex', function() {
    return [
        {
            type: 'lang',
            regex: /(\${1,2}|\\[\(\[])(.*?)(\1|\\[\)\]])/gs,
            replace: function (match, delimiter, content) {
                const isDisplayMode = delimiter.length > 1 || delimiter === "\\[";
                const html = katex.renderToString(content, {
                    displayMode: isDisplayMode,
                });
                return `<span class="katex">${html}</span>`;
            },
        },
    ];
});

const converter = new showdown.Converter();

let backgroundColor = true;

function createNewBlock() {
    const block = document.createElement('div');
    block.style.backgroundColor = backgroundColor ? '#F5F5F5' : '#E8E8E8';
    block.style.padding = '10px';
    block.style.borderRadius = '4px';
    block.style.marginBottom = '10px';

    document.getElementById('response-text').appendChild(block);

    block.querySelectorAll('pre code').forEach((code) => hljs.highlightBlock(code));

    return block;
}

function isUserNearBottom() {
    const responseText = document.getElementById('response-text');
    return responseText.scrollTop + responseText.clientHeight >= responseText.scrollHeight - 100;
}

function scrollToBottom() {
    const responseText = document.getElementById('response-text');
    responseText.scrollTop = responseText.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
    const inputText = document.getElementById("user_input");
    const sendButton = document.getElementById("send-button");

    inputText.addEventListener("input", () => {
        inputText.style.height = 'auto';
        inputText.style.height = (inputText.scrollHeight) + 'px';

        if (inputText.value.trim() !== "") {
            sendButton.disabled = false;
        } else {
            sendButton.disabled = true;
        }
    });

    inputText.dispatchEvent(new Event('input'));

    inputText.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            if (event.shiftKey) {
                event.preventDefault();
                const newValue = inputText.value + "\n";
                inputText.value = newValue;
                inputText.dispatchEvent(new Event('input'));
            } else {
                const trimmedValue = inputText.value.trim();
                if (trimmedValue !== "") {
                    event.preventDefault();
                    sendMessage();
                } else {
                    sendButton.disabled = true;
                }
            }
        }
    });

    sendButton.addEventListener("click", () => {
        sendMessage();
    });
});

function sendMessage() {
    const user_input = document.getElementById('user_input').value;

    // Convert markdown text to HTML
    const html = converter.makeHtml(user_input);
    
    // Create new block for user input
    let userBlock = createNewBlock();
    userBlock.innerHTML = html;
    renderMathInElement(userBlock, {
        delimiters: [
            {left: "\\[", right: "\\]", display: true},
            {left: "\\(", right: "\\)", display: false},
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
        ]
    });
    backgroundColor = !backgroundColor;  // Alternate color after user message

    const formData = new FormData();
    formData.append('user_input', user_input);
    
    const sendButton = document.getElementById("send-button");
    sendButton.disabled = true;
    
    fetchData('/get_response', formData);
    
    document.getElementById('user_input').value = '';
    document.getElementById('user_input').style.height = 'auto';

    if (isUserNearBottom()) {
        scrollToBottom();
    }
}

async function fetchData(url, formData) {
    const largeMessageThreshold = 100;
    let largeMessageParts = null;
    let largeMessagePartIndex = 0;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let messageBuffer = '';
    let tempMessageBuffer = '';
    let delimiterBuffer = '';
    let currentBlock = createNewBlock(); // Create an initial block
    let inCodeBlock = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let separatorIndex;
        const separator = '\x1F\x1F\x1F';
        while ((separatorIndex = buffer.indexOf(separator)) !== -1) {
            let message = buffer.slice(0, separatorIndex);
            //const message = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + separator.length);
            if (message.startsWith("data:")) {
                if (message === "data:___DONE___") {
                    // Message done, prepare for the next message
                    messageBuffer = '';
                    tempMessageBuffer = '';
                    delimiterBuffer = '';
                    currentBlock = null;
                    inCodeBlock = false;
                    backgroundColor = !backgroundColor;  // Alternate color after AI's message
                } else {
                    const rawMessage = message.slice(5);
                    if (rawMessage.length > largeMessageThreshold) {
                        // Split the large message into parts
                        largeMessageParts = rawMessage.split('\n');
                        // Take the first part and add to the buffer
                        rawMessage = largeMessageParts[largeMessagePartIndex++];
                    }
                    // Add the rawMessage to the delimiterBuffer and check if it contains a complete ```
                    delimiterBuffer += rawMessage;
                    let delimiterIndex;
                    while ((delimiterIndex = delimiterBuffer.indexOf("```")) !== -1) {
                        // We found a complete ```, so we can add everything before it to the messageBuffer
                        const beforeDelimiter = delimiterBuffer.slice(0, delimiterIndex + 3);
                        messageBuffer += beforeDelimiter;
                        delimiterBuffer = delimiterBuffer.slice(delimiterIndex + 3);

                        // Check if the message starts or ends a code block
                        if (beforeDelimiter.trim().endsWith("```")) {
                            inCodeBlock = !inCodeBlock;
                        }
                    }

                    // Copy messageBuffer to tempMessageBuffer and add the remaining delimiterBuffer
                    tempMessageBuffer = messageBuffer + delimiterBuffer;

                    // If we're in a code block, append a temporary ``` to tempMessageBuffer
                    if (inCodeBlock) {
                        tempMessageBuffer += "\n```";
                    }

                    // Check if the current block is available, if not, create a new one.
                    if (!currentBlock) {
                        currentBlock = createNewBlock();
                    }

                    // Convert tempMessageBuffer to HTML and assign to the current block
                    const html = converter.makeHtml(tempMessageBuffer);
                    currentBlock.innerHTML = html;
                    currentBlock.querySelectorAll('pre code').forEach((code) => hljs.highlightBlock(code));
                    // Render LaTeX in the newly created block
                    renderMathInElement(currentBlock, {
                        delimiters: [
                            {left: "\\[", right: "\\]", display: true},
                            {left: "\\(", right: "\\)", display: false},
                            {left: "$$", right: "$$", display: true},
                            {left: "$", right: "$", display: false}
                        ]
                    });
                    if (isUserNearBottom()) {
                        scrollToBottom();
                    }
                }
            }

        }
    }

    document.getElementById('response-text').addEventListener('scroll', function() {
        if (isUserNearBottom() && largeMessageParts && largeMessagePartIndex < largeMessageParts.length) {
            // Add the next part of the large message to the buffer
            buffer += largeMessageParts[largeMessagePartIndex++];
            // Continue processing as before
        }
    });
}
