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

    // Function to send message
    function sendMessage() {
        var userInputValue = userInput.value.trim();
        isGeneratingResponse = true;
        var messages = document.getElementById('messages');
        messages.addEventListener('click', function(event) {
            if (event.target.tagName === 'IMG') {
                openImageModal(event.target.src);
            }
        });
        var suggestionsContainer = document.getElementById('suggestionsContainer');

        if (userInputValue === '') return;

        // Disable send button while generating response
        actionButton.disabled = true;

        // Add user message with a label
        messages.innerHTML += `<div class="user"><b>User:</b> ${userInputValue}</div>`;
        userInput.value = '';

        // Clear suggestions container
        suggestionsContainer.innerHTML = '';

        // Add loading placeholder
        var loadingPlaceholder = document.createElement('div');
        loadingPlaceholder.className = 'loading-placeholder';
        loadingPlaceholder.innerText = 'Bot is typing...';
        messages.appendChild(loadingPlaceholder);
        messages.scrollTop = messages.scrollHeight; // Scroll to bottom

        // Send user input to the server
        fetch('ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: userInputValue })
        })
        .then(response => response.json())
        .then(data => {
            // Remove loading placeholder
            messages.removeChild(loadingPlaceholder);
            const text = data.answer.replace(/(?:\r\n|\r|\n)/g, '<br>');

        // Create bot message container
        // let botMessageHTML = `<div class="bot"><b>PR Bot:</b> ${text}`;
        let botMessageHTML = `
            <div class="bot">
                <b>PR Bot:</b> ${text}
        `;
        console.log(data)
        // Add links if they exist
        if (data.links && data.links.length > 0) {
            botMessageHTML += `
                <div id="navigationContainer">
                    ${data.links.map(link => `
                        <a href="${link}" target="_blank" class="navigation-link">
                            <i class="fas fa-arrow-up-right-from-square"></i>
                            <span>Click here</span>
                        </a>
                    `).join('')}
                </div>
            `;
        }
        botMessageHTML += `
                <div class="action-buttons">
                    <button class="read-aloud-btn"><i class="fas fa-volume-up"></i></button>
                    <button class="copy-btn"><i class="fas fa-copy"></i></button>
                    <button class="like-btn"><i class="fas fa-thumbs-up"></i></button>
                    <button class="dislike-btn"><i class="fas fa-thumbs-down"></i></button>
                </div>
        `

        // Close the bot message container
        botMessageHTML += '</div>';

        // Add the complete message to chat
        messages.innerHTML += botMessageHTML;

        // Get the latest bot message container
        const latestBotMessage = messages.querySelector('.bot:last-child');
        if (latestBotMessage) {
            // Get the action buttons
            const readAloudBtn = latestBotMessage.querySelector('.read-aloud-btn');
            const copyBtn = latestBotMessage.querySelector('.copy-btn');
            const likeBtn = latestBotMessage.querySelector('.like-btn');
            const dislikeBtn = latestBotMessage.querySelector('.dislike-btn');
        

        // Read Aloud functionality
        if (readAloudBtn) {
            let isSpeaking = false;
            readAloudBtn.addEventListener('click', () => {
                if (isSpeaking) {
                    speechSynthesis.cancel();
                    isSpeaking = false;
                } else {
                    const speech = new SpeechSynthesisUtterance(text);
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
                try {
                    // Debug logs
                    console.log('Copy button clicked');
                    
                    // Get the bot message content
                    const messageContainer = copyBtn.closest('.bot');
                    console.log('Message container:', messageContainer);
                    
                    if (!messageContainer) {
                        throw new Error('Message container not found');
                    }
                    
                    // Try both selectors
                    let messageText = text;
                    
                    console.log('Message text element:', messageText);
                    
                    if (messageText) {
                        const textToCopy = messageText.trim();
                        console.log('Text to copy:', textToCopy);
                        
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => {
                                const originalIcon = copyBtn.innerHTML;
                                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                                console.log('Text copied successfully');
                                
                                setTimeout(() => {
                                    copyBtn.innerHTML = originalIcon;
                                }, 2000);
                            })
                            .catch(err => {
                                console.error('Clipboard API error:', err);
                                alert('Failed to copy text');
                            });
                    } else {
                        throw new Error('No text content found to copy');
                    }
                } catch (error) {
                    console.error('Copy failed:', error);
                    alert('Unable to copy text');
                }
            });
        }

        // Like functionality
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                // Remove both classes first
                likeBtn.classList.remove('liked');
                dislikeBtn.classList.remove('disliked');
                // Add liked class
                likeBtn.classList.add('liked');
            });
        }

        // Dislike functionality
        if (dislikeBtn) {
            dislikeBtn.addEventListener('click', () => {
                // Remove both classes first
                likeBtn.classList.remove('liked');
                dislikeBtn.classList.remove('disliked');
                // Add disliked class
                dislikeBtn.classList.add('disliked');
            });
        }
    }

    // Add images if present
    if (data.images && data.images.length > 0) {
        data.images.forEach((imageBase64, index) => {
            var img = document.createElement('img');
            img.src = 'data:image/png;base64,' + imageBase64;
            img.className = 'chat-image';
            img.onclick = function() {
                openImageModal(img.src);
            };
            messages.appendChild(img);
        });
    }
    console.log(data.videos);

    if (data.videos && data.videos.length > 0) {
        data.videos.forEach((videoUrl, index) => {
            console.log(videoUrl);
            var video = document.createElement('video');
            video.src = videoUrl;
            video.controls = true;
            video.className = 'chat-video';
            messages.appendChild(video);
        });
    }
            


    // Display follow-up questions
    displaySuggestions(data.suggestions || []);

    messages.scrollTop = messages.scrollHeight; // Scroll to bottom

    actionButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Revert to microphone icon
    actionButton.onclick = startRecording;
    })
    .catch(error => {
            console.error('Error:', error);
            messages.removeChild(loadingPlaceholder);
            messages.innerHTML += `<div class="bot"><b>PR Bot:</b> Sorry, there was an error processing your request.</div>`;
            messages.scrollTop = messages.scrollHeight; // Scroll to bottom
            actionButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Revert to microphone icon
            actionButton.onclick = startRecording;
        })
        .finally(() => {
            isGeneratingResponse = false;
            userInput.disabled = false; // Re-enable input
            actionButton.disabled = false;
            userInput.focus(); // Return focus to input
            userInput.placeholder = 'What else can I help you with?'; // Update placeholder after first question
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