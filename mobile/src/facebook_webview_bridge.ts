export const facebookWebViewBridgeScript = `
(function() {
    if (window.__FB_BOT_BRIDGE__ && window.__FB_BOT_BRIDGE__.__VERSION__ === '2026-04-03') {
        true;
        return;
    }

    var DEBUG = true;
    var loopInFlight = false;
    var fetchInFlight = false;
    var processedPosts = new Set();
    var currentPostCount = 0;
    var config = {
        maxPosts: 5,
        delay: 10,
        comments: [],
        running: false
    };

    function sendToApp(type, message) {
        if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') {
            return;
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, message: message }));
    }

    function log(message) {
        if (DEBUG && console && typeof console.log === 'function') {
            console.log('[FB-BOT] ' + message);
        }

        sendToApp('log', message);
    }

    function wait(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/\\u00a0/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim();
    }

    function firstMeaningfulLine(value) {
        var lines = String(value || '')
            .replace(/\\u00a0/g, ' ')
            .split(/\\r?\\n/)
            .map(function(line) {
                return line.replace(/\\s+/g, ' ').trim();
            })
            .filter(function(line) {
                return line.length >= 3;
            });

        if (lines.length > 0) {
            return lines[0];
        }

        return normalizeText(value);
    }

    function getNearbyTitle(link) {
        if (!link || typeof link.closest !== 'function') {
            return '';
        }

        var container = link.closest('[role="listitem"], article, section, div');
        if (!container) {
            return '';
        }

        var heading = container.querySelector('h1, h2, h3, h4, strong, [role="heading"]');
        if (heading) {
            return firstMeaningfulLine(heading.innerText || heading.textContent || '');
        }

        var sibling = link.parentElement ? link.parentElement.querySelector('span, div') : null;
        if (sibling && sibling !== link) {
            return firstMeaningfulLine(sibling.innerText || sibling.textContent || '');
        }

        return '';
    }

    function getGroupName(link) {
        var candidates = [
            firstMeaningfulLine(link && link.innerText),
            firstMeaningfulLine(link && link.textContent),
            firstMeaningfulLine(link && link.getAttribute && link.getAttribute('aria-label')),
            getNearbyTitle(link)
        ];

        for (var index = 0; index < candidates.length; index += 1) {
            var candidate = candidates[index];
            if (candidate && candidate.length >= 3) {
                return candidate;
            }
        }

        return '';
    }

    function getCurrentPathParts() {
        return String((window.location && window.location.pathname) || '')
            .split('/')
            .filter(Boolean);
    }

    function isLoginPage() {
        var pathname = String((window.location && window.location.pathname) || '').toLowerCase();
        if (pathname.indexOf('/login') !== -1 || pathname.indexOf('/recover') !== -1 || pathname.indexOf('/checkpoint') !== -1) {
            return true;
        }

        return Boolean(document.querySelector('input[name="email"], input[name="pass"], button[name="login"]'));
    }

    function isSpecificGroupPage() {
        var parts = getCurrentPathParts();
        if (parts[0] !== 'groups' || parts.length < 2) {
            return false;
        }

        if (String((window.location && window.location.search) || '').indexOf('category=membership') !== -1) {
            return false;
        }

        var listingSegments = {
            create: true,
            discover: true,
            feed: true,
            joins: true,
            notifications: true,
            search: true,
            your_groups: true
        };

        return !listingSegments[String(parts[1] || '').toLowerCase()];
    }

    function canonicalizeGroupUrl(rawUrl) {
        if (!rawUrl) {
            return null;
        }

        try {
            var url = new URL(rawUrl, window.location.href);
            var parts = url.pathname.split('/').filter(Boolean);
            var groupIndex = parts.indexOf('groups');
            if (groupIndex === -1 || !parts[groupIndex + 1]) {
                return null;
            }

            var groupKey = decodeURIComponent(parts[groupIndex + 1]);
            var invalidSegments = {
                category: true,
                create: true,
                discover: true,
                feed: true,
                joins: true,
                membership: true,
                notifications: true,
                search: true,
                your_groups: true
            };

            if (invalidSegments[String(groupKey).toLowerCase()]) {
                return null;
            }

            if (!/^[A-Za-z0-9._-]+$/.test(groupKey)) {
                return null;
            }

            return 'https://www.facebook.com/groups/' + groupKey;
        } catch (error) {
            return null;
        }
    }

    function addGroupCandidate(groupMap, link) {
        if (!link) {
            return;
        }

        var rawUrl = link.getAttribute('href') || link.href;
        var canonicalUrl = canonicalizeGroupUrl(rawUrl);
        if (!canonicalUrl || groupMap.has(canonicalUrl)) {
            return;
        }

        var name = getGroupName(link);
        if (!name || name.length < 3) {
            return;
        }

        groupMap.set(canonicalUrl, {
            name: name,
            url: canonicalUrl
        });
    }

    function collectGroups(groupMap) {
        var links = document.querySelectorAll('a[href*="/groups/"]');

        Array.prototype.forEach.call(links, function(link) {
            addGroupCandidate(groupMap, link);
        });
    }

    async function crawlGroups() {
        if (fetchInFlight) {
            log('Đang quét nhóm, bỏ qua lệnh trùng.');
            return;
        }

        fetchInFlight = true;
        sendToApp('groups_fetch_started', 'Đang quét danh sách nhóm Facebook...');

        try {
            if (isLoginPage()) {
                sendToApp('groups_fetch_error', 'Bạn cần đăng nhập Facebook trong WebView trước khi lấy danh sách nhóm.');
                return;
            }

            if (isSpecificGroupPage()) {
                sendToApp('groups_fetch_error', 'WebView đang ở trang chi tiết nhóm, không phải danh sách nhóm đã tham gia.');
                return;
            }

            var groupsMap = new Map();
            var previousCount = -1;
            var stablePasses = 0;
            var maxPasses = 8;

            for (var pass = 0; pass < maxPasses; pass += 1) {
                if (isLoginPage()) {
                    sendToApp('groups_fetch_error', 'Facebook yêu cầu đăng nhập lại trước khi lấy danh sách nhóm.');
                    return;
                }

                collectGroups(groupsMap);
                log('Đợt quét ' + (pass + 1) + '/' + maxPasses + ': hiện có ' + groupsMap.size + ' nhóm.');

                if (groupsMap.size === previousCount) {
                    stablePasses += 1;
                } else {
                    stablePasses = 0;
                    previousCount = groupsMap.size;
                }

                if (groupsMap.size > 0 && stablePasses >= 2) {
                    break;
                }

                window.scrollBy(0, Math.max(window.innerHeight * 0.85, 480));
                await wait(1200);
            }

            var groups = Array.from(groupsMap.values()).sort(function(left, right) {
                return left.name.localeCompare(right.name);
            });

            if (groups.length === 0) {
                sendToApp('groups_fetch_empty', 'Không tìm thấy nhóm nào trên trang hiện tại. Hãy mở lại danh sách nhóm đã tham gia và thử lại.');
                return;
            }

            sendToApp('groups_fetched', groups);
        } catch (error) {
            var message = error && error.message ? error.message : 'Unknown error';
            sendToApp('groups_fetch_error', 'Lỗi khi quét danh sách nhóm: ' + message);
        } finally {
            fetchInFlight = false;
        }
    }

    function insertTextIntoInput(input, text) {
        if (!input) {
            return;
        }

        try {
            input.focus();

            var inserted = false;
            if (document.execCommand) {
                try {
                    inserted = document.execCommand('insertText', false, text);
                } catch (error) {
                    inserted = false;
                }
            }

            if (!inserted) {
                if (typeof input.value === 'string') {
                    input.value = text;
                } else {
                    input.textContent = text;
                }
            }

            var inputEvent;
            try {
                inputEvent = new Event('input', { bubbles: true });
            } catch (error) {
                inputEvent = document.createEvent('Event');
                inputEvent.initEvent('input', true, true);
            }

            input.dispatchEvent(inputEvent);

            var changeEvent;
            try {
                changeEvent = new Event('change', { bubbles: true });
            } catch (error) {
                changeEvent = document.createEvent('Event');
                changeEvent.initEvent('change', true, true);
            }

            input.dispatchEvent(changeEvent);
        } catch (error) {
            log('Không thể nhập bình luận: ' + (error && error.message ? error.message : 'unknown error'));
        }
    }

    async function processVisiblePosts() {
        var articles = document.querySelectorAll('article, div[data-ft]');

        for (var index = 0; index < articles.length; index += 1) {
            if (!config.running) {
                break;
            }

            var article = articles[index];
            var postId = article.getAttribute('data-ft') || normalizeText(article.innerText).slice(0, 80);
            if (!postId || processedPosts.has(postId)) {
                continue;
            }

            var commentButton = article.querySelector('a[data-sigil~="m-add-comment-link"], [aria-label*="Comment"], [aria-label*="comment"]');
            if (!commentButton) {
                continue;
            }

            commentButton.click();
            await wait(2000);

            var input = document.querySelector('textarea, div[role="textbox"]');
            if (!input) {
                continue;
            }

            var comment = config.comments[Math.floor(Math.random() * config.comments.length)];
            if (!comment) {
                log('Không có bình luận nào để gửi. Dừng bot.');
                config.running = false;
                break;
            }

            log('Đang gửi bình luận: ' + comment);
            insertTextIntoInput(input, comment);
            await wait(1000);

            var sendButton = document.querySelector('button[type="submit"], [data-sigil="touchable m-add-comment-submit"], [aria-label*="Post"], [aria-label*="Đăng"]');
            if (!sendButton) {
                continue;
            }

            sendButton.click();
            currentPostCount += 1;
            processedPosts.add(postId);

            sendToApp('progress', { count: currentPostCount });
            log('Đã bình luận xong bài viết thứ ' + currentPostCount + '.');
            await wait(config.delay * 1000);
        }
    }

    async function startLoop() {
        if (loopInFlight) {
            log('Bot đã chạy trên trang hiện tại, bỏ qua lệnh start lặp lại.');
            return;
        }

        if (!Array.isArray(config.comments) || config.comments.length === 0) {
            log('Không có danh sách bình luận. Dừng bot.');
            config.running = false;
            return;
        }

        loopInFlight = true;

        try {
            while (config.running) {
                if (currentPostCount >= config.maxPosts) {
                    log('Đã đạt giới hạn số bài cần bình luận. Dừng bot.');
                    config.running = false;
                    break;
                }

                try {
                    await processVisiblePosts();
                } catch (error) {
                    log('Lỗi khi xử lý bài viết: ' + (error && error.message ? error.message : 'unknown error'));
                }

                if (config.running) {
                    window.scrollBy(0, 800);
                    log('Đang cuộn để tìm thêm bài viết...');
                    await wait(3000);
                }
            }
        } finally {
            loopInFlight = false;
        }
    }

    function parseCommand(input) {
        if (!input) {
            return null;
        }

        if (typeof input === 'string') {
            try {
                return JSON.parse(input);
            } catch (error) {
                return null;
            }
        }

        return input;
    }

    function receiveCommand(input) {
        var command = parseCommand(input);
        if (!command || !command.type) {
            return;
        }

        if (command.type === 'start') {
            config = Object.assign({}, config, command.config || {}, { running: true });
            config.maxPosts = Number(config.maxPosts) || 5;
            config.delay = Number(config.delay) || 10;
            config.comments = Array.isArray(config.comments) ? config.comments : [];

            if (!loopInFlight) {
                processedPosts = new Set();
                currentPostCount = 0;
            }

            log('Bot started for URL: ' + window.location.href);
            startLoop();
            return;
        }

        if (command.type === 'stop') {
            config.running = false;
            log('Bot stopped manually.');
            return;
        }

        if (command.type === 'fetch_groups') {
            crawlGroups();
        }
    }

    function attachMessageListeners() {
        var handler = function(event) {
            var payload = event && typeof event === 'object' && 'data' in event ? event.data : event;
            receiveCommand(payload);
        };

        window.addEventListener('message', handler);

        if (document && typeof document.addEventListener === 'function') {
            document.addEventListener('message', handler);
        }
    }

    window.__FB_BOT_BRIDGE__ = {
        __VERSION__: '2026-04-03',
        receiveCommand: receiveCommand
    };

    attachMessageListeners();
    log('Bridge script loaded and ready.');
})();
true;
`;
