/**
 * Bot script for Facebook Mobile (m.facebook.com)
 * This script runs inside the React Native WebView.
 */
(function() {
    const DEBUG = true;
    function sendToApp(type, message) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, message }));
    }

    function log(msg) {
        if (DEBUG) console.log("[FB-BOT] " + msg);
        sendToApp('log', msg);
    }

    let config = {
        maxPosts: 5,
        delay: 10,
        comments: [],
        running: false
    };

    let processedPosts = new Set();
    let currentPostCount = 0;

    async function crawlGroups() {
        log('Bắt đầu quét danh sách nhóm... (URL: ' + window.location.href + ')');
        
        // Scroll more aggressively to load lists
        for (let i = 0; i < 5; i++) {
            window.scrollTo(0, document.body.scrollHeight);
            log('Đang cuộn trang để tải thêm nhóm...');
            await new Promise(r => setTimeout(r, 1500));
        }

        const groups = [];
        // Try multiple selector patterns for FB Mobile
        const selectors = [
            'div[role="listitem"] a[href*="/groups/"]',
            'div[data-sigil="m-group-item"] a',
            'h3 a[href*="/groups/"]',
            'a[href*="/groups/"]'
        ];
        
        let allLinks = [];
        selectors.forEach(s => {
            const found = document.querySelectorAll(s);
            allLinks = allLinks.concat(Array.from(found));
        });

        log('Tìm thấy tổng cộng ' + allLinks.length + ' liên kết thô.');

        allLinks.forEach(link => {
            const href = link.href;
            const name = link.innerText.trim();
            const cleanUrl = href.split('?')[0];

            if (name && cleanUrl.includes('/groups/') && !groups.find(g => g.url === cleanUrl)) {
                // Ignore general links that aren't specific groups
                if (name.length > 2 && !['Groups', 'See all', 'More', 'Joined'].includes(name)) {
                    // Ensure it matches a group ID/Slug pattern
                    const parts = cleanUrl.split('/groups/');
                    if (parts[1] && parts[1].length > 2) {
                        groups.push({ name, url: cleanUrl });
                    }
                }
            }
        });

        log(`Kết quả: Tìm thấy ${groups.length} nhóm hợp lệ.`);
        sendToApp('groups_fetched', groups);
    }

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
            } else if (data.type === 'fetch_groups') {
                crawlGroups();
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
