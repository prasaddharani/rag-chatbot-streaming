document.addEventListener('DOMContentLoaded', function() {
    var chatbox = document.getElementById('chatbox');
    chatbox.style.display = 'none'; // Ensure chatbox is hidden initially
    let isGeneratingResponse = false;

    var userInput = document.getElementById('userInput');
    var actionButton = document.getElementById('actionButton');
    var chatbotIcon = document.getElementById('chatbot-icon');

    // Clear localStorage on page refresh/close
    window.addEventListener('beforeunload', function() {
        // log into the console
        console.log('Clearing localStorage');
        localStorage.clear();
    });

    // Check if the user has visited before
    const visitedBefore = localStorage.getItem('visitedBefore');

    if (!visitedBefore) {
        // New session
        console.log('First time visitor');
        localStorage.setItem('visitedBefore', 'true');
        userInput.placeholder = 'How can I assist you today?';
    } else {
        // Existing session
        userInput.placeholder = 'What else can I help you with?';
    }
    

    // Toggle chatbox display when chat icon is clicked
    document.getElementById('toggleChat').addEventListener('click', function() {
        chatbox.style.display = chatbox.style.display === 'none' ? 'flex' : 'none';
        if (chatbox.style.display === 'flex') {
            chatbox.focus(); // Ensure chatbox is focused when opened
            chatbotIcon.style.display = 'none'; // Hide the chatbot icon
        } else {
            chatbotIcon.style.display = 'block'; // Show the chatbot icon
        }
    });

    // Event listener for the maximize/minimize button
    document.getElementById('toggleSize').addEventListener('click', function() {
        var chatbox = document.getElementById('chatbox');
        chatbox.classList.toggle('maximized'); // Toggle class

    // // Update the button icon and title
    //     var toggleSizeButton = document.getElementById('toggleSize');
    //     if (chatbox.classList.contains('maximized')) {
    //         toggleSizeButton.innerHTML = '&#9724;'; // Minimize icon
    //         toggleSizeButton.title = 'Minimize Chatbox';
    //     } else {
    //         toggleSizeButton.innerHTML = '&#9723;'; // Maximize icon
    //         toggleSizeButton.title = 'Maximize Chatbox';
    //     }
    // Update the button icon and title
    var toggleSizeButton = document.getElementById('toggleSize');
    var icon = toggleSizeButton.querySelector('i');
    if (chatbox.classList.contains('maximized')) {
        icon.classList.remove('fa-window-maximize');
        icon.classList.add('fa-window-restore');
        toggleSizeButton.title = 'Restore Down';
    } else {
        icon.classList.remove('fa-window-restore');
        icon.classList.add('fa-window-maximize');
        toggleSizeButton.title = 'Maximize Chatbox';
    }
    });

    // Close chatbox when close button is clicked
    document.getElementById('closeChat').addEventListener('click', function() {
        chatbox.style.display = 'none';
        chatbotIcon.style.display = 'block'; // Show the chatbot icon when chatbox is closed
    });

    // Handle sending messages on Enter key press
    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !isGeneratingResponse) {
            event.preventDefault();
            sendMessage();
        }
    });
    // Change button icon based on user input
    userInput.addEventListener('input', function() {
        if (userInput.value.trim() === '') {
            actionButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Show microphone icon
            actionButton.onclick = startRecording;
        } else {
            actionButton.innerHTML = '<i class="fas fa-paper-plane"></i>'; // Show send icon
            actionButton.onclick = sendMessage;
        }
    });

    // Function to display suggestions
    function displaySuggestions(suggestions) {
        var suggestionsContainer = document.getElementById('suggestionsContainer');
        suggestionsContainer.innerHTML = ''; // Clear previous suggestions

        if (suggestions.length > 0) {
            suggestions.forEach(function(suggestion) {
                var button = document.createElement('button');
                button.className = 'suggestion-button';
                button.textContent = suggestion;
                button.onclick = function() {
                    userInput.value = suggestion;
                    suggestionsContainer.innerHTML = ''; // Clear suggestions after selection
                    actionButton.innerHTML = '<i class="fas fa-paper-plane"></i>'; // Show send icon
                    actionButton.onclick = sendMessage;
                };
                suggestionsContainer.appendChild(button);
            });
        }
    }

    // Function to simulate typing with faster speed and multiple characters at a time.
    function simulateTyping(text, container) {
        return new Promise(resolve => {
            // Replace both actual newlines and literal "\n\n" sequences with <br>
            const processedText = text.replace(/(\\n\\n|\n\n)/g, "<br>");
            // Split processed text into tokens while keeping HTML tags intact.
            const tokens = processedText.match(/(<[^>]+>|[^<]+)/g) || [];
            function typeToken(i) {
                if (i < tokens.length) {
                    const token = tokens[i];
                    if (token.startsWith('<') && token.endsWith('>')) {
                        // Append HTML tags immediately.
                        container.innerHTML += token;
                        messages.scrollTop = messages.scrollHeight;
                        typeToken(i + 1);
                    } else {
                        let j = 0;
                        function typeChar() {
                            if (j < token.length) {
                                // Append 3 characters at a time for a faster effect.
                                const slice = token.slice(j, j + 3);
                                container.innerHTML += slice;
                                j += 3;
                                messages.scrollTop = messages.scrollHeight;
                                setTimeout(typeChar, 10); // Adjust delay (10ms) as needed.
                            } else {
                                typeToken(i + 1);
                            }
                        }
                        typeChar();
                    }
                } else {
                    resolve();
                }
            }
            typeToken(0);
        });
    }

    // Example usage inside sendMessage():
    function sendMessage() {
        var userInputValue = userInput.value.trim();
        if (userInputValue === '') return;

        isGeneratingResponse = true;
        var messages = document.getElementById('messages');

        // Disable send button while generating response
        actionButton.disabled = true;

        // Add user's message
        messages.innerHTML += `<div class="user" style="font-size: 17px;"><b>User:</b> ${userInputValue}</div>`;
        userInput.value = '';

        // Clear suggestions container
        var suggestionsContainer = document.getElementById('suggestionsContainer');
        suggestionsContainer.innerHTML = '';

        // Add loading placeholder
        var loadingPlaceholder = document.createElement('div');
        loadingPlaceholder.className = 'loading-placeholder';
        loadingPlaceholder.innerText = 'Bot is typing...';
        messages.appendChild(loadingPlaceholder);
        messages.scrollTop = messages.scrollHeight;

        // Variables to manage bot container and typing queue
        var botMessageContainer;
        var typeQueue = Promise.resolve();
        
        fetch('ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userInputValue })
        })
        .then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            function read() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        actionButton.disabled = false;
                        isGeneratingResponse = false;
                        return;
                    }
                    const chunk = decoder.decode(value, { stream: true });
                    chunk.split("\n\n").forEach(part => {
                        if (part.startsWith("data:")) {
                            try {
                                const data = JSON.parse(part.replace("data:", ""));
                                if (data.answer_chunk) {
                                    // Remove loading placeholder on first chunk
                                    if (loadingPlaceholder.parentNode) {
                                        loadingPlaceholder.parentNode.removeChild(loadingPlaceholder);
                                    }
                                    // Create bot container with label on first chunk if not present
                                    if (!botMessageContainer) {
                                        botMessageContainer = document.createElement('div');
                                        botMessageContainer.className = 'bot';
                                        botMessageContainer.style.fontSize = '17px';
                                        botMessageContainer.innerHTML = `<b>PR Bot:</b> `;
                                        messages.appendChild(botMessageContainer);
                                    }
                                    // Chain the typing animation for a natural sequential effect.
                                    typeQueue = typeQueue.then(() =>
                                        simulateTyping(data.answer_chunk + "<br>", botMessageContainer)
                                    );
                                }
                                if (data.final) {
                                    // Chain a promise to add feedback icons, then images, videos, and suggestions
                                    typeQueue = typeQueue.then(() => {
                                        // Create a container for the feedback icons and append it to the bot container
                                        const actionButtons = document.createElement('div');
                                        actionButtons.className = 'action-buttons';
                                        actionButtons.innerHTML = `
                                            <button class="read-aloud-btn"><i class="fas fa-volume-up"></i></button>
                                            <button class="copy-btn"><i class="fas fa-copy"></i></button>
                                            <button class="like-btn"><i class="fas fa-thumbs-up"></i></button>
                                            <button class="dislike-btn"><i class="fas fa-thumbs-down"></i></button>
                                        `;
                                        botMessageContainer.appendChild(actionButtons);
                                
                                        // Extract the bot's text (excluding the label)
                                        const botText = botMessageContainer.innerText.replace('PR Bot:', '').trim();
                                
                                        // Get the action buttons from the newly created container
                                        const readAloudBtn = actionButtons.querySelector('.read-aloud-btn');
                                        const copyBtn = actionButtons.querySelector('.copy-btn');
                                        const likeBtn = actionButtons.querySelector('.like-btn');
                                        const dislikeBtn = actionButtons.querySelector('.dislike-btn');
                                
                                        // Read Aloud functionality
                                        if (readAloudBtn) {
                                            let isSpeaking = false;
                                            readAloudBtn.addEventListener('click', () => {
                                                if (isSpeaking) {
                                                    speechSynthesis.cancel();
                                                    isSpeaking = false;
                                                } else {
                                                    const speech = new SpeechSynthesisUtterance(botText);
                                                    speech.lang = 'en-US';
                                                    speech.volume = 1;
                                                    speech.rate = 1;
                                                    speech.pitch = 1;
                                                    speechSynthesis.speak(speech);
                                                    isSpeaking = true;
                                                    speech.onend = () => {
                                                        isSpeaking = false;
                                                    };
                                                }
                                            });
                                        }
                                
                                        // Copy functionality
                                        if (copyBtn) {
                                            copyBtn.addEventListener('click', () => {
                                                navigator.clipboard.writeText(botText)
                                                    .then(() => {
                                                        const originalIcon = copyBtn.innerHTML;
                                                        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                                                        setTimeout(() => {
                                                            copyBtn.innerHTML = originalIcon;
                                                        }, 2000);
                                                    })
                                                    .catch(err => {
                                                        console.error('Clipboard API error:', err);
                                                        alert('Failed to copy text');
                                                    });
                                            });
                                        }
                                
                                        // Like functionality
                                        if (likeBtn) {
                                            likeBtn.addEventListener('click', () => {
                                                likeBtn.classList.toggle('liked');
                                                if (dislikeBtn.classList.contains('disliked')) {
                                                    dislikeBtn.classList.remove('disliked');
                                                }
                                            });
                                        }
                                
                                        // Dislike functionality
                                        if (dislikeBtn) {
                                            dislikeBtn.addEventListener('click', () => {
                                                dislikeBtn.classList.toggle('disliked');
                                                if (likeBtn.classList.contains('liked')) {
                                                    likeBtn.classList.remove('liked');
                                                }
                                            });
                                        }
                                
                                        // Now append images (after the feedback icons)
                                        if (data.images && data.images.length > 0) {
                                            data.images.forEach(imageBase64 => {
                                                const img = document.createElement('img');
                                                img.src = 'data:image/png;base64,' + imageBase64;
                                                img.className = 'chat-image';
                                                img.onclick = function() {
                                                    openImageModal(img.src);
                                                };
                                                messages.appendChild(img);
                                            });
                                        }
                                
                                        // Append videos after images
                                        if (data.videos && data.videos.length > 0) {
                                            data.videos.forEach(videoUrl => {
                                                const video = document.createElement('video');
                                                video.src = videoUrl;
                                                video.controls = true;
                                                video.className = 'chat-video';
                                                messages.appendChild(video);
                                            });
                                        }
                                
                                        // Finally, display suggestions (if any)
                                        displaySuggestions(data.suggestions || []);
                                    });
                                }
                            } catch (e) {
                                console.error("Error parsing streamed data", e);
                            }
                        }
                    });
                    read();
                });
            }
            read();
        })
        .catch(error => {
            console.error('Error:', error);
            if (loadingPlaceholder.parentNode) {
                loadingPlaceholder.parentNode.removeChild(loadingPlaceholder);
            }
            messages.innerHTML += `<div class="bot"><b>PR Bot:</b> Sorry, there was an error processing your request.</div>`;
            messages.scrollTop = messages.scrollHeight;
            actionButton.disabled = false;
        })
        .finally(() => {
            isGeneratingResponse = false;
            userInput.disabled = false;
            actionButton.disabled = false;
            userInput.focus();
            userInput.placeholder = 'What else can I help you with?';
        });
    }

    // Resizable functionality
    var resizeHandle = document.getElementById('resize-handle');
    var chatbox = document.getElementById('chatbox');

    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();

        function onMouseMove(event) {
            var newWidth = event.clientX - chatbox.getBoundingClientRect().left;
            var newHeight = event.clientY - chatbox.getBoundingClientRect().top;

            newWidth = Math.max(newWidth, 300);
            newHeight = Math.max(newHeight, 200);

            chatbox.style.width = newWidth + 'px';
            chatbox.style.height = newHeight + 'px';

            // Adjust image size within chatbox
            var images = chatbox.querySelectorAll('img');
            images.forEach(img => {
                img.style.maxWidth = (newWidth - 20) + 'px';
                img.style.maxHeight = (newHeight - 100) + 'px';
            });
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function startRecording() {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Your browser doesn't support speech recognition. Please use text input.");
            return;
        }

        var recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US'; // Set language to English
        recognition.interimResults = false; // Get final results only
        recognition.maxAlternatives = 1; // Get only one transcription

        recognition.onstart = function() {
            console.log("Recording started...");
            actionButton.innerHTML = '<i class="fas fa-microphone-alt"></i>'; // Change icon while recording
        };

        recognition.onerror = function(event) {
            console.error(event.error);
            alert("Speech recognition error. Please try again.");
        };

        recognition.onresult = function(event) {
            var transcript = event.results[0][0].transcript;
            userInput.value = transcript; // Set transcribed text to input field
            sendMessage(); // Automatically send the message
        };

        recognition.onend = function() {
            actionButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Revert to microphone icon
            console.log("Recording ended.");
        };

        recognition.start();
    }

    // Function to open image modal
    function openImageModal(src) {
        var modal = document.getElementById('imageModal');
        var modalImg = document.getElementById('modalImage');
        var closeBtn = document.getElementsByClassName('image-modal-close')[0];

        modal.style.display = 'block';
        modalImg.src = src;

        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };

        modal.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
});