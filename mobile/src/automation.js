/**
 * Bot script for Facebook Mobile (m.facebook.com)
 * This script runs inside the React Native WebView.
 */
(function() {
    const DEBUG = true;
    function log(msg) {
        if (DEBUG) console.log("[FB-BOT] " + msg);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    let config = {
        maxPosts: 5,
        delay: 10,
        comments: [],
        running: false
    };

    let processedPosts = new Set();
    let currentPostCount = 0;

    window.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'start') {
                config = { ...config, ...data.config, running: true };
                log("Bot started for URL: " + window.location.href);
                startLoop();
            } else if (data.type === 'stop') {
                config.running = false;
                log("Bot stopped manually.");
            }
        } catch (e) {
            log("Error parsing message: " + e.message);
        }
    });

    async function startLoop() {
        while (config.running) {
            if (currentPostCount >= config.maxPosts) {
                log("Reached max post limit. Stopping.");
                config.running = false;
                break;
            }

            try {
                await processVisiblePosts();
            } catch (err) {
                log("Error in loop: " + err.message);
            }

            if (config.running) {
                // Scroll down to find more posts
                window.scrollBy(0, 800);
                log("Scrolling to find more posts...");
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }

    async function processVisiblePosts() {
        // Facebook mobile articles usually have data-ft attributes or are inside structured divs
        const articles = document.querySelectorAll('article, div[data-ft]');
        
        for (let article of articles) {
            if (!config.running) break;

            const postID = article.getAttribute('data-ft') || article.innerText.slice(0, 50);
            if (processedPosts.has(postID)) continue;

            const commentBtn = article.querySelector('a[data-sigil~="m-add-comment-link"], [aria-label*="Comment"]');
            if (commentBtn) {
                log("Found commentable post. Processing...");
                commentBtn.click();
                
                // Wait for input to appear
                await new Promise(r => setTimeout(r, 2000));
                
                const input = document.querySelector('textarea, div[role="textbox"]');
                if (input) {
                    const comment = config.comments[Math.floor(Math.random() * config.comments.length)];
                    log("Typing comment: " + comment);
                    
                    // Simple input injection
                    input.focus();
                    document.execCommand('insertText', false, comment);
                    
                    await new Promise(r => setTimeout(r, 1000));
                    
                    const sendBtn = document.querySelector('button[type="submit"], [data-sigil="touchable m-add-comment-submit"]');
                    if (sendBtn) {
                        sendBtn.click();
                        log("Success! Comment posted.");
                        currentPostCount++;
                        processedPosts.add(postID);
                        
                        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
                            type: 'progress', 
                            count: currentPostCount 
                        }));
                        
                        // Wait for delay
                        log("Waiting " + config.delay + "s delay...");
                        await new Promise(r => setTimeout(r, config.delay * 1000));
                    }
                }
            }
        }
    }

    log("Bot script loaded and ready.");
})();
