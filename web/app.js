function triggerVibration(pattern) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch(e){}
        }
    }

    async function getDeviceFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = "top"; ctx.font = "14px 'Arial'"; ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60"; ctx.fillRect(125,1,62,20);
            ctx.fillStyle = "#069"; ctx.fillText("拾色季 SHISEJI", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)"; ctx.fillText("拾色季 SHISEJI", 4, 17);
            const b64 = canvas.toDataURL();
            let hash = 0;
            for (let i = 0; i < b64.length; i++) {
                hash = ((hash << 5) - hash) + b64.charCodeAt(i);
                hash = hash & hash;
            }
            return hash.toString(16) + "-" + screen.colorDepth + "-" + screen.width;
        } catch(e) { return "fallback-fp-" + Date.now(); }
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function highlightColors(text) {
        if (!text) return text;
        const colorMap = {
            "玫瑰粉": "#FFF0F5", "珊瑚红": "#FFE4E1", "奶油黄": "#FFFFE0", "薄荷绿": "#F0FFF0", "雾霾蓝": "#F0F8FF", 
            "奶茶色": "#FDF5E6", "炭灰色": "#F5F5F5", "藏青色": "#F0F4F8", "酒红色": "#FFF0F0", "香槟色": "#FFF8E7", 
            "燕麦色": "#FDF9F1", "莫兰迪": "#F4F4F4", "卡其色": "#F5E6D3", "豆沙色": "#E8C8C8", "裸粉色": "#F7E1D7",
            "樱花粉": "#FDE6E8", "抹茶绿": "#E8F0E4", "克莱因蓝": "#E6EEF8"
        };
        let processedText = escapeHTML(text);
        for (const [colorName, bgColor] of Object.entries(colorMap)) {
            const regex = new RegExp(colorName, "g");
            const capsuleHTML = `<span class="color-capsule" style="background-color: ${bgColor}; color: #5A504B;">${colorName}</span>`;
            processedText = processedText.replace(regex, capsuleHTML);
        }
        return processedText;
    }

    let activeModal = null;
    let modalReturnFocus = null;

    function getModalFocusables(modal) {
        return Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        )).filter(element => !element.closest('[hidden]') && element.offsetParent !== null);
    }

    function openModal(modal, initialFocus, returnFocus = null) {
        modalReturnFocus = returnFocus instanceof HTMLElement
            ? returnFocus
            : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        activeModal = modal;
        const app = document.querySelector('.app-container');
        if (app) {
            app.inert = true;
            app.setAttribute('inert', '');
            app.setAttribute('aria-hidden', 'true');
        }
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const panel = modal.querySelector(':scope > div');
            if (panel) panel.classList.remove('scale-95');
            const target = initialFocus || getModalFocusables(modal)[0];
            if (target) target.focus();
        }, 10);
    }

    function closeModal(modal) {
        modal.classList.add('opacity-0');
        const panel = modal.querySelector(':scope > div');
        if (panel) panel.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            const app = document.querySelector('.app-container');
            if (app) {
                app.inert = false;
                app.removeAttribute('inert');
                app.removeAttribute('aria-hidden');
            }
            activeModal = null;
            if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
            modalReturnFocus = null;
        }, 300);
    }

    document.addEventListener('keydown', event => {
        if (!activeModal) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (activeModal.id === 'privacyModal') closePrivacyModal();
            else if (activeModal.id === 'customAlert') closeCustomAlert();
            else if (activeModal.id === 'saveOverlay') closeSaveOverlay();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusables = getModalFocusables(activeModal);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    function showPrivacyModal() {
        triggerVibration(30);
        const modal = document.getElementById('privacyModal');
        openModal(modal, document.getElementById('privacyTitle'));
    }
    function closePrivacyModal() {
        triggerVibration(30);
        closeModal(document.getElementById('privacyModal'));
    }

    function acceptPrivacy() {
        const consent = document.getElementById('privacyConsent');
        consent.checked = true;
        consent.dispatchEvent(new Event('change', { bubbles: true }));
        closePrivacyModal();
    }

    function checkLastReport() {
        document.getElementById('restoreContainer').classList.add('hidden');
    }

    function restoreLastReport() {
        showToast("为保护隐私，照片与报告不会在浏览器中长期保存");
    }

    document.addEventListener('DOMContentLoaded', () => {
        const dropzoneInput = document.getElementById('dropzone-file');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            dropzoneInput.setAttribute('accept', 'image/jpeg, image/png, image/jpg, image/heic');
        } else {
            dropzoneInput.setAttribute('accept', 'image/*');
        }
        ['privacyModal', 'customAlert', 'saveOverlay'].forEach(id => {
            const modal = document.getElementById(id);
            modal.addEventListener('mousedown', event => {
                if (event.target !== modal) return;
                if (id === 'privacyModal') closePrivacyModal();
                else if (id === 'customAlert') closeCustomAlert();
                else closeSaveOverlay();
            });
        });

        const activationInput = document.getElementById('activationCode');
        const activationSubmit = document.getElementById('activationSubmit');
        if (activationInput && activationSubmit) {
            activationInput.addEventListener('input', () => {
                const normalized = normalizeActivationInput(activationInput.value);
                if (activationInput.value !== normalized) activationInput.value = normalized;
                activationInput.setAttribute('aria-invalid', 'false');
                setActivationStatus('');
                updateActivationSubmitState();
            });
            activationInput.addEventListener('keydown', event => {
                if (event.key !== 'Enter' || event.isComposing) return;
                event.preventDefault();
                if (!activationSubmit.disabled) verifyCode();
            });
            updateActivationSubmitState();
        }
        const privacyConsent = document.getElementById('privacyConsent');
        if (privacyConsent) privacyConsent.addEventListener('change', updateAnalyzeButtonState);
        const dimensionDetails = document.getElementById('dimensionDetails');
        if (dimensionDetails) dimensionDetails.addEventListener('toggle', resizeReportChart);
        updateAnalyzeButtonState();
    });

    let userImageBase64 = "";
    window.currentCode = "";
    window.analysisToken = "";
    window.currentAnalysisResult = null;
    window.personalizedImageState = { beauty: 'idle', outfit: 'idle' };
    let progressInterval = null; 
    let analysisRecoveryTimer = null;
    let activeAnalysisController = null;
    let analysisRunId = 0;
    let photoSelectionId = 0;
    let photoProcessing = false;
    let photoHasBlockingIssue = true;

    function updateAnalyzeButtonState() {
        const button = document.getElementById('analyzeBtn');
        const consent = document.getElementById('privacyConsent');
        if (!button) return;
        const disabled = !userImageBase64 || photoProcessing || photoHasBlockingIssue || !consent?.checked;
        button.disabled = disabled;
        button.setAttribute('aria-disabled', String(disabled));
    }


    function clearAnalysisRuntime() {
        if (progressInterval) clearInterval(progressInterval);
        if (analysisRecoveryTimer) clearTimeout(analysisRecoveryTimer);
        progressInterval = null;
        analysisRecoveryTimer = null;
        const elapsed = document.getElementById('analysisElapsed');
        if (elapsed) elapsed.textContent = '已等待 0:00';
    }

    function cancelAnalysis() {
        analysisRunId += 1;
        if (activeAnalysisController) activeAnalysisController.abort();
        activeAnalysisController = null;
        clearAnalysisRuntime();
        showStep('step-upload');
        showToast('已停止本页等待。再次开始时会优先恢复已提交任务，不会重复扣次');
    }

    function showToast(message, tone = 'default') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = tone === 'preview'
            ? 'toast-preview text-[11px] tracking-[0.12em] px-5 py-2.5 rounded-full mb-3 toast-enter flex items-center gap-2'
            : 'bg-[#3D342F]/90 backdrop-blur-md text-[#F4EFEA] text-[13px] tracking-widest px-6 py-3 rounded-full shadow-xl mb-3 toast-enter flex items-center gap-2';
        toast.innerHTML = '<svg class="w-4 h-4 text-[#DABFB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        toast.appendChild(document.createTextNode(String(message)));
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.replace('toast-enter', 'toast-exit');
            setTimeout(() => toast.remove(), 400);
        }, tone === 'preview' ? 1600 : 2500);
    }

    function showCustomAlert(message, returnFocus = null) {
        triggerVibration([50, 50, 50]);
        document.getElementById('alertMessage').textContent = String(message);
        const modal = document.getElementById('customAlert');
        openModal(modal, document.getElementById('alertTitle'), returnFocus);
    }

    function closeCustomAlert() {
        triggerVibration(30);
        closeModal(document.getElementById('customAlert'));
    }

    function showStep(stepId) {
        ['step-activation','step-upload','step-loading','step-result'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(stepId).classList.remove('hidden');
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.classList.toggle('report-mode', stepId === 'step-result');
        const mainContainer = document.getElementById('mainContainer');
        if (mainContainer) mainContainer.scrollTop = 0;
        if (stepId === 'step-result') setupReportIndex();
    }

    let reportIndexObserver = null;
    function setupReportIndex() {
        if (reportIndexObserver) reportIndexObserver.disconnect();
        const links = Array.from(document.querySelectorAll('.report-index a'));
        const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
        const scrollRoot = document.getElementById('mainContainer');
        reportIndexObserver = new IntersectionObserver(() => {
            const rootRect = scrollRoot.getBoundingClientRect();
            const readingLine = rootRect.top + (rootRect.height * .22);
            const visible = sections.find(section => {
                const rect = section.getBoundingClientRect();
                return rect.top <= readingLine && rect.bottom > readingLine;
            }) || sections
                .map(section => ({ section, distance: Math.abs(section.getBoundingClientRect().top - readingLine) }))
                .sort((a, b) => a.distance - b.distance)[0]?.section;
            if (!visible) return;
            links.forEach(link => {
                if (link.getAttribute('href') === `#${visible.id}`) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }, { root: scrollRoot, rootMargin: '-15% 0px -65%', threshold: [0, .25, .5] });
        sections.forEach(section => reportIndexObserver.observe(section));
    }

    function setRuntimeImage(image, src, onReady) {
        if (!image || !src) return;
        image.classList.add('hidden');
        image.onload = () => {
            image.classList.remove('hidden');
            if (onReady) onReady();
        };
        image.onerror = () => {
            image.classList.add('hidden');
            image.removeAttribute('src');
        };
        image.src = src;
    }

    function isLocalPreview() {
        const loopback = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        return window.location.protocol === 'file:' || (loopback && new URLSearchParams(window.location.search).has('preview'));
    }

    let activationVerificationPending = false;
    let resetVerificationPending = false;

    function normalizeActivationInput(value) {
        return String(value ?? '')
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/[^A-Z0-9-]/g, '')
            .slice(0, 12);
    }

    function isActivationInputComplete(value) {
        return /^[A-Z0-9-]{12}$/.test(value);
    }

    function setActivationStatus(message = '', tone = 'default') {
        const status = document.getElementById('activationStatus');
        const helpLink = document.getElementById('activationHelp');
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone;
        status.hidden = !message;
        if (helpLink) helpLink.hidden = Boolean(message);
    }

    function updateActivationSubmitState() {
        const input = document.getElementById('activationCode');
        const submit = document.getElementById('activationSubmit');
        if (!input || !submit) return;
        const disabled = activationVerificationPending || !isActivationInputComplete(input.value);
        submit.disabled = disabled;
        submit.setAttribute('aria-disabled', String(disabled));
    }

    function getActivationErrorMessage(response, data) {
        const serverMessage = typeof data?.error === 'string' ? data.error : '';
        if (response.status === 429) return '尝试次数较多，请稍候片刻再试。';
        if (response.status >= 500) return '密钥验证服务暂时繁忙，请稍后重试。';
        if (serverMessage.includes('格式')) return '密钥格式不正确，请检查后重新输入。';
        if (data?.remainingUses === 0 || serverMessage.includes('用完')) {
            return '该密钥无效或可用次数已用完，请联系提供密钥的店铺。';
        }
        return '密钥未通过验证，请检查后重新输入。';
    }

    function clearClientWorkflow({ clearConsent = true } = {}) {
        analysisRunId += 1;
        photoSelectionId += 1;
        if (activeAnalysisController) activeAnalysisController.abort();
        activeAnalysisController = null;
        clearAnalysisRuntime();

        userImageBase64 = '';
        photoProcessing = false;
        photoHasBlockingIssue = true;
        window.currentAnalysisRequestId = null;
        window.currentAnalysisResult = null;
        window.personalizedImageState = { beauty: 'idle', outfit: 'idle' };
        window.remainingUses = undefined;
        window.visualToken = '';
        window.visualRequestId = '';
        generatedImagePayload = null;
        sessionStorage.removeItem('shisejiAnalysisJob');
        sessionStorage.removeItem('shisejiAnalysisRequestId');

        const fileInput = document.getElementById('dropzone-file');
        const preview = document.getElementById('imagePreview');
        const quality = document.getElementById('photoQuality');
        const consent = document.getElementById('privacyConsent');
        if (fileInput) fileInput.value = '';
        if (preview) {
            preview.removeAttribute('src');
            preview.classList.add('hidden');
        }
        const uploadText = document.getElementById('uploadText');
        if (uploadText) uploadText.innerText = '选择一张正面照片';
        if (quality) {
            quality.className = 'photo-quality hidden';
            quality.innerHTML = '';
        }
        if (clearConsent && consent) consent.checked = false;
        updateAnalyzeButtonState();
    }

    async function verifyCode() {
        const inputElement = document.getElementById('activationCode');
        const submitBtn = document.getElementById('activationSubmit');
        const code = normalizeActivationInput(inputElement.value);
        inputElement.value = code;
        if (activationVerificationPending) return;

        if (!isActivationInputComplete(code)) {
            setActivationStatus(code ? '密钥应为 12 位字母、数字或连字符。' : '请输入专属密钥后继续。', 'error');
            inputElement.setAttribute('aria-invalid', 'true');
            updateActivationSubmitState();
            inputElement.focus();
            return;
        }

        triggerVibration(50);
        if (isLocalPreview()) {
            clearClientWorkflow();
            window.currentCode = '';
            window.analysisToken = '';
            showStep('step-upload');
            showToast('已进入本地界面预览，不验证或消耗密钥');
            return;
        }

        const defaultText = '开启我的色彩档案';
        let shouldRefocus = false;
        let timeoutId = null;
        activationVerificationPending = true;
        inputElement.disabled = true;
        submitBtn.innerText = '正在验证密钥…';
        submitBtn.setAttribute('aria-busy', 'true');
        setActivationStatus('正在安全验证，请稍候。', 'loading');
        updateActivationSubmitState();

        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 12_000);
            const response = await fetch('/api/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activationCode: code }),
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.valid) {
                clearClientWorkflow();
                window.currentCode = code;
                window.analysisToken = data.analysisToken;
                inputElement.setAttribute('aria-invalid', 'false');
                setActivationStatus('');
                checkLastReport();
                showStep('step-upload');
                const premiumMsg = data.remainingUses !== undefined
                    ? `密钥验证通过，可生成次数剩余 ${data.remainingUses} 次`
                    : '密钥验证通过，可以开始生成色彩档案';
                showToast(premiumMsg);
            } else {
                inputElement.setAttribute('aria-invalid', 'true');
                setActivationStatus(getActivationErrorMessage(response, data), 'error');
                shouldRefocus = true;
            }
        } catch (error) {
            console.error('Activation verification failed:', error);
            inputElement.setAttribute('aria-invalid', 'true');
            const message = error?.name === 'AbortError'
                ? '验证等待时间较长，请稍后重新尝试。'
                : '网络连接暂时不可用，请检查网络后重试。';
            setActivationStatus(message, 'error');
            shouldRefocus = true;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            activationVerificationPending = false;
            inputElement.disabled = false;
            submitBtn.innerText = defaultText;
            submitBtn.removeAttribute('aria-busy');
            updateActivationSubmitState();
            if (shouldRefocus) inputElement.focus();
        }
    }

    function handleImageUpload(event) {
        const input = event.target;
        const file = input.files[0];
        if(file) {
            const selectionId = ++photoSelectionId;
            const preview = document.getElementById('imagePreview');
            triggerVibration(50);
            photoProcessing = true;
            photoHasBlockingIssue = true;
            document.getElementById('uploadText').innerText = "图像引擎处理中...";
            updateAnalyzeButtonState();
            const reader = new FileReader();
            reader.onload = function(e) {
                if (selectionId !== photoSelectionId) return;
                const img = new Image();
                img.onload = function() {
                    if (selectionId !== photoSelectionId) return;
                    const quality = evaluateImageQuality(img);
                    renderPhotoQuality(quality);
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 800; 

                    if (width > height) {
                        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                    } else {
                        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                    }

                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { img.onerror(); return; }
                    ctx.drawImage(img, 0, 0, width, height);

                    userImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    photoProcessing = false;
                    photoHasBlockingIssue = quality.blocking.length > 0;
                    const pendingJob = JSON.parse(sessionStorage.getItem('shisejiAnalysisJob') || 'null');
                    window.currentAnalysisRequestId = pendingJob?.requestId
                        || sessionStorage.getItem('shisejiAnalysisRequestId')
                        || crypto.randomUUID();
                    sessionStorage.setItem('shisejiAnalysisRequestId', window.currentAnalysisRequestId);
                    
                    setRuntimeImage(preview, userImageBase64);
                    document.getElementById('uploadText').innerText = "照片已就绪，轻触可重选";
                    input.value = '';
                    updateAnalyzeButtonState();
                };
                img.onerror = function() {
                    if (selectionId !== photoSelectionId) return;
                    userImageBase64 = '';
                    photoProcessing = false;
                    photoHasBlockingIssue = true;
                    input.value = '';
                    document.getElementById('uploadText').innerText = '无法读取这张照片，请重新选择';
                    preview.classList.add('hidden');
                    preview.removeAttribute('src');
                    renderPhotoQuality({ blocking: ['文件已损坏或不是受支持的照片格式'], warnings: [] });
                    updateAnalyzeButtonState();
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                if (selectionId !== photoSelectionId) return;
                userImageBase64 = '';
                photoProcessing = false;
                photoHasBlockingIssue = true;
                input.value = '';
                document.getElementById('uploadText').innerText = '无法读取这张照片，请重新选择';
                preview.classList.add('hidden');
                preview.removeAttribute('src');
                renderPhotoQuality({ blocking: ['读取照片失败，请重新选择原图'], warnings: [] });
                updateAnalyzeButtonState();
            };
            reader.readAsDataURL(file);
        }
    }

    function evaluateImageQuality(img) {
        const blocking = [];
        const warnings = [];
        if (Math.min(img.naturalWidth, img.naturalHeight) < 480) blocking.push('照片分辨率偏低，请选择更清晰的原图');

        const sample = document.createElement('canvas');
        sample.width = 72; sample.height = 72;
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, sample.width, sample.height);
        const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
        let total = 0; let totalSq = 0; let edge = 0; let previous = null;
        for (let i = 0; i < pixels.length; i += 4) {
            const luma = pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722;
            total += luma; totalSq += luma * luma;
            if (previous !== null) edge += Math.abs(luma - previous);
            previous = luma;
        }
        const count = pixels.length / 4;
        const mean = total / count;
        const deviation = Math.sqrt(Math.max(0, totalSq / count - mean * mean));
        const detail = edge / Math.max(1, count - 1);
        if (mean < 48) warnings.push('画面偏暗，建议换到窗边自然光');
        if (mean > 220) warnings.push('画面偏亮，面部可能过曝');
        if (deviation < 22 || detail < 5) warnings.push('画面细节偏少，请确认对焦清晰且未使用重度磨皮');
        return { blocking, warnings };
    }

    function renderPhotoQuality({ blocking, warnings }) {
        const el = document.getElementById('photoQuality');
        el.className = 'photo-quality';
        if (blocking.length) {
            el.classList.add('block');
            el.innerHTML = `<b>暂不建议分析</b><br>${blocking.map(escapeHTML).join('；')}`;
        } else if (warnings.length) {
            el.classList.add('warn');
            el.innerHTML = `<b>照片可用，但还能更准</b><br>${warnings.map(escapeHTML).join('；')}`;
        } else {
            el.classList.add('good');
            el.innerHTML = '<b>照片基础质量良好</b><br>可继续分析；请再确认是自然光、正面且无重度滤镜。';
        }
        el.classList.remove('hidden');
    }

    async function startAnalysis() {
        const localPreview = isLocalPreview();
        if (!localPreview && (!window.currentCode || !window.analysisToken)) {
            showCustomAlert("通行证已过期，请重新验签");
            showStep('step-activation'); 
            return; 
        }
        if (!userImageBase64) {
            showCustomAlert("请先选择一张照片");
            return;
        }
        if (!document.getElementById('privacyConsent').checked) {
            showCustomAlert("请先阅读并同意隐私政策");
            return;
        }

        triggerVibration(50);
        const currentRunId = ++analysisRunId;
        clearAnalysisRuntime();
        showStep('step-loading');
        const previewStatus = document.getElementById('loadingPreviewStatus');
        if (previewStatus) previewStatus.classList.toggle('hidden', !localPreview);
        
        const loadingText = document.getElementById('loadingText');
        const analysisSteps = Array.from(document.querySelectorAll('#analysisSteps .analysis-step'));
        analysisSteps.forEach((step, index) => {
            step.classList.toggle('active', index === 0);
            step.classList.remove('complete');
            if (index === 0) step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
        });
        const startedAt = Date.now();
        progressInterval = setInterval(() => {
            const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            document.getElementById('analysisElapsed').textContent = `已等待 ${minutes}:${seconds}`;
        }, 1000);

        if (localPreview) {
            setTimeout(() => {
                if (currentRunId !== analysisRunId) return;
                clearInterval(progressInterval);
                analysisSteps.forEach(step => {
                    step.classList.remove('active');
                    step.classList.add('complete');
                    step.removeAttribute('aria-current');
                });
                loadingText.innerText = '示例色彩档案已生成';

                const dimensionValues = {
                    skin_temperature: 72,
                    skin_lightness: 70,
                    skin_clarity: 58,
                    skin_softness: 82,
                    cheek_temperature: 74,
                    lip_temperature: 70,
                    eye_depth: 44,
                    eye_clarity: 60,
                    hair_depth: 66,
                    hair_temperature: 68,
                    hair_skin_contrast: 46,
                    facial_contrast: 42,
                    depth_capacity: 48,
                    brightness_capacity: 68,
                    chroma_capacity: 46,
                    muted_capacity: 84
                };
                const dimensionNames = {
                    skin_temperature: '肤色冷暖倾向',
                    skin_lightness: '肤色明度',
                    skin_clarity: '肤色清透度',
                    skin_softness: '肤色柔和度',
                    cheek_temperature: '面颊色调',
                    lip_temperature: '原生唇色倾向',
                    eye_depth: '瞳孔深浅',
                    eye_clarity: '瞳孔清晰度',
                    hair_depth: '原生发色深浅',
                    hair_temperature: '原生发色冷暖',
                    hair_skin_contrast: '发肤对比度',
                    facial_contrast: '五官整体对比度',
                    depth_capacity: '深色承载力',
                    brightness_capacity: '明亮色承载力',
                    chroma_capacity: '鲜艳色承载力',
                    muted_capacity: '柔雾色适配度'
                };
                const demoResult = {
                    identity_code: 'SSJ-02',
                    season_name: '柔光暖春',
                    season_en: 'WARM · LIGHT · SOFT',
                    description: '你的整体色彩关系柔和而偏暖，轻盈、细腻且具有自然光感。',
                    style_keywords: ['柔光', '温暖', '清透'],
                    color_impression: '柔和、温暖、清透。让颜色衬托你，而不是盖过你。',
                    feature_colors: [
                        { label: '肌肤', hex: '#E5B7A1' },
                        { label: '瞳色', hex: '#5D453B' },
                        { label: '发色', hex: '#4A3832' },
                        { label: '对比', hex: '#A78B7E' }
                    ],
                    radar_data: [
                        { name: '冷暖', value: 72, desc: '偏暖色更容易提气色' },
                        { name: '明度', value: 70, desc: '中浅色更显轻盈' },
                        { name: '纯度', value: 46, desc: '降低饱和度更协调' },
                        { name: '柔和度', value: 82, desc: '柔和过渡更自然' },
                        { name: '对比度', value: 44, desc: '低对比搭配更耐看' }
                    ],
                    dimension_data: Object.entries(dimensionValues).map(([key, value]) => ({
                        key,
                        name: dimensionNames[key],
                        value,
                        observation: '本地界面预览示例'
                    })),
                    best_colors: [
                        { name: '蜜桃珊瑚', hex: '#D9967C' },
                        { name: '裸杏玫瑰', hex: '#CDA48F' },
                        { name: '榛果棕', hex: '#A78969' },
                        { name: '柔炭棕', hex: '#7C707B' },
                        { name: '杏仁奶油', hex: '#EED0B5' },
                        { name: '暖沙金', hex: '#B49A76' },
                        { name: '燕麦米', hex: '#D8C9B7' },
                        { name: '雾桃灰', hex: '#B99E98' }
                    ],
                    makeup_advice: '选择蜜桃豆沙唇色、柔暖珊瑚腮红与香槟米金眼妆，让肤色与五官处在同一种柔暖光线里。',
                    outfit_advice: '以燕麦针织搭配暖米半裙，用榛果棕配件建立轮廓，适合日常通勤与轻社交。',
                    accessory_advice: '优先香槟金、柔棕皮具与低对比配饰，避免过度冷硬的金属光泽。',
                    style_reference: '柔焦午后、天然织物与安静温暖的低对比层次。',
                    avoid_colors: ['冷硬纯黑', '荧光玫粉', '冰冷浅灰']
                };

                setTimeout(() => {
                    if (currentRunId !== analysisRunId) return;
                    clearAnalysisRuntime();
                    renderAIResult(demoResult);
                    showStep('step-result');
                    triggerVibration([80, 40, 120]);
                    showToast('当前为本地示例报告，不消耗密钥次数');
                }, 250);
            }, 1200);
            return;
        }

        try {
            let successData = null;
            const requestId = window.currentAnalysisRequestId || crypto.randomUUID();
            window.currentAnalysisRequestId = requestId;
            sessionStorage.setItem('shisejiAnalysisRequestId', requestId);
            let task = JSON.parse(sessionStorage.getItem('shisejiAnalysisJob') || 'null');
            if (!task || task.requestId !== requestId) {
                const controller = new AbortController();
                activeAnalysisController = controller;
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                const response = await fetch('/api/analyze', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
                    body: JSON.stringify({ imageBase64: userImageBase64, analysisToken: window.analysisToken, requestId })
                });
                clearTimeout(timeoutId);
                activeAnalysisController = null;
                if (response.status === 400 || response.status === 403) throw new Error('AUTH_FAILED');
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || 'SUBMIT_UNKNOWN');
                task = { taskId: payload.taskId, jobToken: payload.jobToken, requestId };
                sessionStorage.setItem('shisejiAnalysisJob', JSON.stringify(task));
            }
            const pollDeadline = Date.now() + 17 * 60 * 1000;
            while (Date.now() < pollDeadline) {
                if (currentRunId !== analysisRunId) return;
                const response = await fetch('/api/analysis-status', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: task.taskId, jobToken: task.jobToken })
                });
                if (response.status === 403) throw new Error('AUTH_FAILED');
                if (response.ok) {
                    const payload = await response.json();
                    if (payload.status === 'completed') {
                        successData = payload.data;
                        window.remainingUses = payload.remainingUses;
                        window.visualToken = payload.visualToken;
                        window.visualRequestId = payload.requestId;
                        sessionStorage.removeItem('shisejiAnalysisJob');
                        sessionStorage.removeItem('shisejiAnalysisRequestId');
                        break;
                    }
                    if (payload.status === 'failed') {
                        sessionStorage.removeItem('shisejiAnalysisJob');
                        sessionStorage.removeItem('shisejiAnalysisRequestId');
                        window.currentAnalysisRequestId = crypto.randomUUID();
                        throw new Error('ANALYSIS_FAILED');
                    }
                    const isProcessing = payload.status === 'processing';
                    loadingText.innerText = isProcessing ? '正在分析照片与色彩关系' : '任务已排队，正在等待处理';
                    analysisSteps[0].classList.remove('active');
                    analysisSteps[0].classList.add('complete');
                    analysisSteps[0].removeAttribute('aria-current');
                    analysisSteps[1].classList.toggle('active', isProcessing);
                    if (isProcessing) analysisSteps[1].setAttribute('aria-current', 'step');
                }
                await new Promise(resolve => setTimeout(resolve, 2500 + Math.random() * 1000));
            }
            if (!successData) throw new Error('STATUS_UNKNOWN');

            if (currentRunId !== analysisRunId) return;
            clearAnalysisRuntime();
            analysisSteps.forEach(step => {
                step.classList.remove('active');
                step.classList.add('complete');
                step.removeAttribute('aria-current');
            });
            loadingText.innerText = '你的色彩档案已生成';
            
            setTimeout(() => {
                if (successData && successData.error) {
                    showCustomAlert(successData.error);
                    showStep('step-upload'); 
                } else if (successData && (successData.season_name.includes("未检测到") || successData.season_name.includes("阻断") || successData.season_name.includes("无法完成"))) {
                    showCustomAlert(successData.description || "抱歉，无法完成精准诊断。请上传合规原图。");
                    showStep('step-upload');
                } else if (successData) {
                    renderAIResult(successData);
                    showStep('step-result');
                    startPersonalizedImageGeneration(successData);
                    triggerVibration([100, 50, 200]);
                    setTimeout(
                        () => showToast(`色彩档案生成成功，剩余 ${window.remainingUses} 次`),
                        800
                    );
                } else {
                    throw new Error("无数据返回");
                }
            }, 500);

        } catch (error) {
            if (currentRunId !== analysisRunId) return;
            activeAnalysisController = null;
            clearAnalysisRuntime();
            console.error("引擎连接失败:", error);
            if (error.message === "AUTH_FAILED") {
                forceKickToHome("令牌验证失败，请重新唤醒密钥");
            } else if (error.name === 'AbortError' || error.message === 'SUBMIT_UNKNOWN' || error.message === 'STATUS_UNKNOWN') {
                showCustomAlert('连接等待超时，任务可能仍在处理中。返回后再次开始会优先恢复，不会重复提交或扣次。');
                showStep('step-upload');
            } else {
                showCustomAlert('暂时无法完成分析，请稍后重试。照片仍保留；未生成有效报告不会扣次。');
                showStep('step-upload');
            }
        }
    }

    function setPersonalizedImageState(kind, status, message) {
        window.personalizedImageState[kind] = status;
        const stateElement = document.getElementById(`${kind}GenerationState`);
        if (!stateElement) return;
        stateElement.classList.remove('hidden');
        stateElement.dataset.status = status;
        const label = stateElement.querySelector('span');
        if (label) label.innerText = message;
        updatePersonalizedImageCaption(kind, status);
    }

    function updatePersonalizedImageCaption(kind, status) {
        const saveButton = document.getElementById(`${kind}EffectSaveBtn`);
        if (saveButton) saveButton.classList.toggle('hidden', status !== 'complete');
        if (kind === 'beauty') {
            const kicker = document.getElementById('beautyCaptionKicker');
            const copy = document.getElementById('beautyCaptionText');
            if (!kicker || !copy) return;
            if (status === 'complete') {
                kicker.innerText = '拾色季 · 妆发设计 01';
                copy.innerText = '不是换一张脸，而是让属于你的光被看见。';
            } else if (status === 'failed') {
                kicker.innerText = '原始自拍 · 色彩基准';
                copy.innerText = '专属妆发暂未完成；当前保留原始自拍，不用占位图替代你。';
            } else {
                kicker.innerText = '原始自拍 · 专属妆发生成中';
                copy.innerText = '正在保留你的身份特征，并重新设计更适合你的妆发。';
            }
            return;
        }

        const kicker = document.getElementById('outfitCaptionKicker');
        if (!kicker) return;
        if (status === 'complete') kicker.innerText = '拾色季 · 穿搭设计 01';
        else if (status === 'failed') kicker.innerText = '专属穿搭暂未完成 · 点击图中重试';
        else kicker.innerText = '拾色季 · 穿搭设计生成中';
    }

    const SAFE_STYLE_IMAGE_CLIENT_CODES = new Set([
        'style_image_configuration_failed',
        'style_image_request_build_failed',
        'style_image_job_claim_failed',
        'style_image_queue_dispatch_failed',
        'style_image_photo_download_failed',
        'style_image_model_timeout',
        'style_image_model_request_failed',
        'style_image_model_rejected',
        'style_image_response_parse_failed',
        'style_image_result_extract_failed',
        'style_image_provider_result_write_failed',
        'style_image_storage_failed',
        'style_image_job_complete_failed',
        'style_image_sign_failed',
        'style_image_handler_failed',
        'style_image_job_timeout',
        'style_image_queue_timeout',
        'style_image_submission_unknown',
        'style_image_processing_timeout',
        'style_image_client_failed'
    ]);

    async function generatePersonalizedStyleImage(kind, analysis, retry = false) {
        if (!analysis || !userImageBase64 || window.personalizedImageState[kind] === 'loading') return;
        const loadingCopy = kind === 'beauty' ? '正在设计专属妆发' : '正在设计完整穿搭';
        setPersonalizedImageState(kind, 'loading', loadingCopy);
        try {
            let payload;
            for (let attempt = 0; attempt < 61; attempt += 1) {
                if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                let response;
                try {
                    response = await fetch('/api/generate-style-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            kind,
                            imageBase64: attempt === 0 ? userImageBase64 : undefined,
                            visualToken: window.visualToken,
                            requestId: window.visualRequestId,
                            analysis,
                            retry: retry && attempt === 0
                        })
                    });
                } finally {
                    clearTimeout(timeoutId);
                }
                payload = await response.json();
                if (response.status === 202 && payload.status === 'processing') continue;
                if (!response.ok || payload.status !== 'completed' || !payload.imageUrl) {
                    const failure = new Error('STYLE_IMAGE_FAILED');
                    failure.diagnosticCode = payload.diagnosticCode || 'style_image_handler_failed';
                    throw failure;
                }
                break;
            }
            if (!payload?.imageUrl) {
                const failure = new Error('STYLE_IMAGE_PROCESSING_TIMEOUT');
                failure.diagnosticCode = 'style_image_processing_timeout';
                throw failure;
            }

            if (kind === 'beauty') {
                const image = document.getElementById('makeupEditorialAvatar');
                setRuntimeImage(image, payload.imageUrl);
            } else {
                const board = document.getElementById('outfitEditorialBoard');
                const image = document.getElementById('outfitEditorialImage');
                if (board && image) {
                    setRuntimeImage(image, payload.imageUrl, () => board.classList.add('has-editorial-image'));
                }
            }
            setPersonalizedImageState(kind, 'complete', '专属视觉已完成');
        } catch (error) {
            const diagnosticCode = SAFE_STYLE_IMAGE_CLIENT_CODES.has(error?.diagnosticCode)
                ? error.diagnosticCode
                : 'style_image_client_failed';
            console.error(`${kind} personalized image failed:`, diagnosticCode);
            const failedLabel = kind === 'beauty' ? '妆发图生成未完成' : '穿搭图生成未完成';
            const failedCopy = `${failedLabel} · 点击重试`;
            setPersonalizedImageState(kind, 'failed', failedCopy);
        }
    }

    function startPersonalizedImageGeneration(analysis) {
        window.personalizedImageState = { beauty: 'idle', outfit: 'idle' };
        Promise.allSettled([
            generatePersonalizedStyleImage('beauty', analysis),
            generatePersonalizedStyleImage('outfit', analysis)
        ]).then(() => {
            const completed = Object.values(window.personalizedImageState).filter((state) => state === 'complete').length;
            if (completed === 2) showToast('专属妆发与穿搭视觉已完成');
        });
    }

    function retryPersonalizedImage(kind) {
        if (!['beauty', 'outfit'].includes(kind) || !window.currentAnalysisResult) return;
        generatePersonalizedStyleImage(kind, window.currentAnalysisResult, true);
    }

    function renderAIResult(d) {
        window.currentAnalysisResult = d;
        applyReportTheme(d);
        if(userImageBase64) {
            const a = document.getElementById('userAvatarResult');
            setRuntimeImage(a, userImageBase64);
            const makeupEditorialAvatar = document.getElementById('makeupEditorialAvatar');
            setRuntimeImage(makeupEditorialAvatar, userImageBase64);
        }
        updatePersonalizedImageCaption('beauty', 'idle');
        updatePersonalizedImageCaption('outfit', 'idle');
        
         ['season-name','season-en','desc'].forEach(key => {
            const map = {'season-name':'season_name','season-en':'season_en','desc':'description'};
            if(document.getElementById(`res-${key}`)) document.getElementById(`res-${key}`).innerText = d[map[key]] || "生成中...";
         });

         const identityCodeElement = document.getElementById('res-identity-code');
         if (identityCodeElement) {
             identityCodeElement.innerText = d.identity_code ? `COLOR ID · ${d.identity_code}` : '';
         }

         const assessmentElement = document.getElementById('res-identity-assessment');
         if (assessmentElement) {
             const assessment = d.identity_assessment;
             assessmentElement.innerText = assessment?.message || '';
             assessmentElement.dataset.confidence = assessment?.level || '';
         }

        const keywordContainer = document.getElementById('res-style-keywords');
        if (keywordContainer) {
            const keywords = Array.isArray(d.style_keywords)
                ? d.style_keywords.slice(0, 5)
                : [];
            keywordContainer.innerHTML = keywords.map((keyword) =>
                `<span class="bg-[#E9ECEA] text-[#38413D] text-[12px] tracking-[0.06em] px-3 py-1.5 rounded-[8px]">${escapeHTML(keyword)}</span>`
            ).join('');
        }

        const impressionElement = document.getElementById('res-color-impression');
        if (impressionElement) {
            impressionElement.innerText = d.color_impression || d.description || '';
        }

        ['makeup','outfit','accessory','style-reference'].forEach(key => {
            const map = {'makeup':'makeup_advice','outfit':'outfit_advice','accessory':'accessory_advice','style-reference':'style_reference'};
            let text = d[map[key]] || "...";
            if(document.getElementById(`res-${key}`)) document.getElementById(`res-${key}`).innerHTML = highlightColors(text);
        });

        const makeupAdvice = d.makeup_advice || '以柔和、协调的颜色建立自然好气色。';
        const outfitAdvice = d.outfit_advice || '将推荐色放在靠近面部的位置，用低冲突配色完成整体造型。';
        const makeupEditorial = document.getElementById('res-makeup-editorial');
        const makeupRecipe = document.getElementById('res-makeup-recipe');
        const outfitEditorial = document.getElementById('res-outfit-editorial');
        const outfitFormula = document.getElementById('res-outfit-formula');
        if (makeupEditorial) makeupEditorial.innerText = '从发型、光线到妆面，重新设计更适合你的完整表达。';
        if (makeupRecipe) makeupRecipe.innerHTML = highlightColors(makeupAdvice);
        if (outfitEditorial) outfitEditorial.innerText = '把这份好看，穿进真实生活。';
        if (outfitFormula) outfitFormula.innerHTML = highlightColors(outfitAdvice);
        const outfitBoard = document.getElementById('outfitEditorialBoard');
        const outfitImage = document.getElementById('outfitEditorialImage');
        if (outfitBoard && outfitImage) {
            outfitBoard.classList.remove('has-editorial-image');
            outfitImage.classList.add('hidden');
            outfitImage.removeAttribute('src');
        }

        const resAvoidEl = document.getElementById('res-avoid');
        if (resAvoidEl) {
            const avoidColors = Array.isArray(d.avoid_colors)
                ? d.avoid_colors.slice(0, 5)
                : (typeof d.avoid_colors === 'string' ? [d.avoid_colors] : []);
            resAvoidEl.innerHTML = avoidColors.length
                ? avoidColors.map((color) => {
                    const colorName = typeof color === 'string' ? color : color.name;
                    return `<span class="color-capsule-avoid">${escapeHTML(colorName)}</span>`;
                }).join('')
                : '<span class="archive-avoid-empty">暂无补充建议</span>';
        }

        const today = new Date();
        const dateStr = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0') + today.getDate().toString().padStart(2, '0');
        const randomSuffix = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 10);
        
        if(document.getElementById('archive-no')) {
            document.getElementById('archive-no').innerText = `ARCHIVE NO. SSJ-${dateStr}-${randomSuffix}`;
        }

        const f = document.getElementById('res-hex-extraction'); f.innerHTML = '';
        if (d.feature_colors && Array.isArray(d.feature_colors)) {
            const labels = ["肌肤底色", "面颊色调", "原生发色", "瞳孔特征"];
            d.feature_colors.forEach((hexValue, index) => {
                let colorHex = escapeHTML(typeof hexValue === 'string' ? hexValue : hexValue.hex);
                let colorLabel = escapeHTML(typeof hexValue === 'string' ? labels[index] || "特征色" : hexValue.label);
                f.innerHTML += `
                <div class="bg-white rounded-[12px] p-3 shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-[#F4EFEA] flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full shadow-inner border border-black/5 flex-shrink-0" style="background-color:${colorHex};"></div>
                    <div class="flex flex-col">
                        <span class="text-[12px] text-[#4A403A] font-medium tracking-widest">${colorLabel}</span>
                        <span class="text-[12px] text-[#76665E] font-mono mt-0.5 uppercase tracking-[0.04em]">${colorHex}</span>
                    </div>
                </div>`;
            });
        }

        const p = document.getElementById('res-progress-bars'); p.innerHTML = '';
        const r = [];
        if (d.radar_data && Array.isArray(d.radar_data)) {
            const labels = ['色调(冷暖)', '明度(深浅)', '彩度(饱和)', '清浊(清透)', '对比(反差)'];
            d.radar_data.forEach((val, index) => {
                let value = Math.max(0, Math.min(100, Number(typeof val === 'number' ? val : val.value) || 0));
                let name = escapeHTML(typeof val === 'number' ? labels[index] || "维度" : val.name);
                let desc = escapeHTML(typeof val === 'number' ? "" : val.desc);
                r.push(value);
                p.innerHTML += `
                <div class="mb-4">
                    <div class="flex justify-between items-end mb-1.5">
                        <span class="text-[12px] text-[#6B5D55] font-medium tracking-widest">${name}</span>
                        <span class="text-[12px] font-serif-custom font-bold text-[#3D342F]">${value}</span>
                    </div>
                    <div class="w-full h-[2px] mb-1.5 overflow-hidden">
                        <div class="bg-[#9A7665] h-full progress-bar-fill" style="width:${value}%" data-target-scale="1"></div>
                    </div>
                    <span class="text-[12px] text-[#76665E] tracking-[0.02em]">${desc || ''}</span>
                </div>`;
            });
        }
        
         setTimeout(() => {
            document.querySelectorAll('.progress-bar-fill').forEach(e => { e.style.transform = 'scaleX(1)'; });
         }, 600);

         const dimensions = document.getElementById('res-dimensions');
         if (dimensions) {
             const dimensionGroups = [
                 { name: '肤色基底', range: '01—04' },
                 { name: '面部色彩', range: '05—08' },
                 { name: '发肤关系', range: '09—12' },
                 { name: '色彩承载', range: '13—16' }
             ];
             const dimensionData = Array.isArray(d.dimension_data) ? d.dimension_data.slice(0, 16) : [];
             dimensions.innerHTML = dimensionGroups.map((group, groupIndex) => {
                 const rows = dimensionData.slice(groupIndex * 4, groupIndex * 4 + 4);
                 if (!rows.length) return '';
                 return `<article class="dimension-group"><header><span>${group.range}</span><h3>${group.name}</h3></header><div class="dimension-group-rows">${rows.map((item, rowIndex) => {
                     const value = Math.max(0, Math.min(100, Number(item.value) || 0));
                     const index = groupIndex * 4 + rowIndex + 1;
                     const name = escapeHTML(item.name);
                     const observation = escapeHTML(getSafeObservation(item.observation));
                     return `<div class="dimension-row" title="${observation}" aria-label="${name}，${value} 分。${observation}"><div class="dimension-row-main"><div class="dimension-row-title"><span><i class="dimension-row-index">${String(index).padStart(2, '0')}</i>${name}</span></div><div class="dimension-row-track"><div class="dimension-row-fill" style="width:${value}%"></div></div></div><span class="dimension-row-value">${value}</span></div>`;
                 }).join('')}</div></article>`;
             }).join('');
         }

         const c = document.getElementById('res-best-colors'); c.innerHTML = '';
        if (d.best_colors && Array.isArray(d.best_colors)) {
            const normalized = d.best_colors.map((val) => ({
                hex: escapeHTML(typeof val === 'string' ? val : val.hex),
                name: escapeHTML(typeof val === 'string' ? '推荐色' : val.name)
            }));
            c.innerHTML = `<div class="palette-primary" role="list" aria-label="优先靠近面部的推荐色">${normalized.slice(0, 4).map((color) =>
                `<figure class="palette-swatch palette-swatch-primary" role="listitem"><i style="--swatch-color:${color.hex}" aria-hidden="true"></i><figcaption><b>${color.name}</b><span>${color.hex.toUpperCase()}</span></figcaption></figure>`
            ).join('')}</div><div class="palette-extended"><div class="palette-group-heading"><span>延展色盘</span><span>下装 · 包袋 · 鞋履</span></div><div class="palette-secondary" role="list" aria-label="适合下装、包袋和鞋履的延展色">${normalized.slice(4, 8).map((color) =>
                `<figure class="palette-swatch palette-swatch-secondary" role="listitem"><i style="--swatch-color:${color.hex}" aria-hidden="true"></i><figcaption><b>${color.name}</b><span>${color.hex.toUpperCase()}</span></figcaption></figure>`
            ).join('')}</div></div>`;
            const closingColors = document.getElementById('res-closing-colors');
            if (closingColors) {
                const coreColors = normalized.slice(0, 4);
                closingColors.innerHTML = coreColors.map((color) => `<i style="--closing-color:${color.hex}" aria-hidden="true"></i>`).join('');
                closingColors.setAttribute('aria-label', `你的核心本命色：${coreColors.map((color) => color.name).join('、')}`);
            }
            renderColorStyling(normalized);
            renderEditorialFormulas(normalized);
        }


        initRadarChart(r);
    }

    function renderEditorialFormulas(colors) {
        if (!Array.isArray(colors) || colors.length < 4) return;
        const pick = (index, fallback = 0) => colors[index] || colors[fallback] || { name: '推荐色', hex: '#BFA89F' };
        const beauty = document.getElementById('res-beauty-formula');
        if (beauty) {
            const tones = [
                { role: '唇色', color: pick(0), note: '点亮气色' },
                { role: '腮红', color: pick(1), note: '柔化轮廓' },
                { role: '眼妆', color: pick(2), note: '加深神采' }
            ];
            beauty.innerHTML = tones.map((item) => `<article class="beauty-tone"><i style="--tone-color:${item.color.hex}" aria-hidden="true"></i><div><b>${item.role}</b><span>${item.color.name}</span><small>${item.note}</small></div></article>`).join('');
        }
        const wardrobe = document.getElementById('res-wardrobe-formula');
        if (wardrobe) {
            const pieces = [
                { en: 'NEAR FACE', role: '上装主色', color: pick(4, 0), note: '贴近面部提亮' },
                { en: 'SILHOUETTE', role: '轮廓辅助', color: pick(2, 1), note: '建立质感层次' },
                { en: 'SIGNATURE', role: '点睛配饰', color: pick(0), note: '小面积留下记忆' }
            ];
            wardrobe.innerHTML = pieces.map((item) => `<article class="wardrobe-piece"><i style="--wardrobe-color:${item.color.hex}" aria-hidden="true"></i><div><small>${item.en}</small><b>${item.role}</b><span>${item.color.name}</span><em>${item.note}</em></div></article>`).join('');
        }
    }

    function renderColorStyling(colors) {
        const container = document.getElementById('res-color-styling');
        if (!container || !Array.isArray(colors) || colors.length < 4) return;
        const pick = (index, fallback = 0) => colors[index] || colors[fallback] || { name: '推荐色', hex: '#BFA89F' };
        const schemes = [
            {
                title: '静奢日常', scene: 'DAILY QUIET LUXURY',
                colors: [pick(4, 1), pick(2, 1), pick(0), pick(5, 2)],
                ratios: [55, 25, 12, 8],
                copy: '以最浅色建立大面积呼吸感，中间色负责包袋或下装，靠近面部放入提气色，最后用金属光泽收尾。',
                texture: '针织 · 真丝 · 哑光皮革'
            },
            {
                title: '温柔社交', scene: 'SOFT SOCIAL',
                colors: [pick(1), pick(4, 0), pick(0), pick(5, 2)],
                ratios: [50, 28, 14, 8],
                copy: '让柔和主色成为第一印象，以轻盈浅色提亮，再把最有生命力的颜色控制在唇妆、丝巾或小包。',
                texture: '雪纺 · 缎面 · 细闪金属'
            },
            {
                title: '重要时刻', scene: 'SIGNATURE OCCASION',
                colors: [pick(3, 2), pick(1), pick(0), pick(5, 2)],
                ratios: [58, 22, 12, 8],
                copy: '用色谱中较深的一色稳定轮廓，辅助色贴近面部，点睛色只出现一次，形成克制而清晰的存在感。',
                texture: '精纺羊毛 · 丝绒 · 香槟金'
            }
        ];
        window.reportColorStylingSchemes = schemes;
        container.innerHTML = `<div class="color-styling-tabs" role="group" aria-label="配色场景">${schemes.map((scheme, index) =>
            `<button type="button" class="color-styling-tab${index === 0 ? ' active' : ''}" aria-pressed="${index === 0}" aria-controls="res-color-styling-panel" onclick="selectColorStyling(${index})">${scheme.title}</button>`
        ).join('')}</div><div id="res-color-styling-panel" role="region" aria-label="当前配色方案" aria-live="polite" aria-atomic="true"></div>`;
        selectColorStyling(0);
    }

    function selectColorStyling(index) {
        const schemes = window.reportColorStylingSchemes || [];
        const scheme = schemes[index] || schemes[0];
        const panel = document.getElementById('res-color-styling-panel');
        if (!scheme || !panel) return;
        document.querySelectorAll('.color-styling-tab').forEach((button, buttonIndex) => {
            button.classList.toggle('active', buttonIndex === index);
            button.setAttribute('aria-pressed', String(buttonIndex === index));
        });
        panel.innerHTML = getColorStylingCardHTML(scheme, index);
    }

    function getReadableColorForeground(hex) {
        const normalized = String(hex || '').trim().replace(/^#/, '');
        const expanded = normalized.length === 3
            ? normalized.split('').map((character) => character + character).join('')
            : normalized;
        if (!/^[0-9a-f]{6}$/i.test(expanded)) return '#44362F';
        const luminance = [0, 2, 4].map((offset) => {
            const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);


        const darkContrast = (luminance + 0.05) / (0.041 + 0.05);
        const lightContrast = (0.964 + 0.05) / (luminance + 0.05);
        if (darkContrast >= 4.5) return '#44362F';
        if (lightContrast >= 4.5) return '#FFFAF7';
        return luminance >= 0.179 ? '#000000' : '#FFFFFF';
    }

    function getColorStylingCardHTML(scheme, index) {
        return `<article class="color-look">
            <div class="color-look-head"><div><h3>${scheme.title}</h3></div></div>
            <div class="color-ratio">${scheme.colors.map((color, colorIndex) => `<i style="width:${scheme.ratios[colorIndex]}%;background:${color.hex};--ratio-foreground:${getReadableColorForeground(color.hex)}" title="${color.name}" aria-label="${color.name}，占比 ${scheme.ratios[colorIndex]}%">${scheme.ratios[colorIndex]}%</i>`).join('')}</div>
            <div class="color-look-formula"><p>${scheme.copy}</p><b>${scheme.texture}</b></div>
        </article>`;
    }

    function applyReportTheme() {

        const root = document.documentElement.style;



        ['--report-primary', '--report-secondary', '--report-metal'].forEach((property) => root.removeProperty(property));
    }

    function resizeReportChart() {
        if (window.myRadarChart && typeof window.myRadarChart.resize === 'function') {
            window.requestAnimationFrame(() => window.myRadarChart.resize());
        }
    }

    function getSafeObservation(value) {
        const text = String(value || '').trim();
        const previewOnly = /本地.*预览|预览示例|本地界面/.test(text);
        if (window.location.protocol !== 'file:' && previewOnly) return '基于本次照片条件生成';
        return text || '基于本次照片条件生成';
    }

    function initRadarChart(data) {
        const ctx = document.getElementById('radarChart').getContext('2d');
        if(window.myRadarChart) window.myRadarChart.destroy();
        
        Chart.defaults.font.family = "ui-serif, 'Songti SC', STSong, SimSun, serif";
        Chart.defaults.color = "#8C7A70";
        
        window.myRadarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['冷暖色调','深浅明度','饱和彩度','清浊(清透)','对比(反差)'],
                datasets: [{
                    data: data,
                    backgroundColor: 'rgba(218,191,180,0.5)',
                    borderColor: 'rgba(200,180,170,1)',
                    borderWidth: 1.5,
                    pointBackgroundColor: '#FFFFFF',
                    pointBorderColor: '#CBAAA0',
                    pointBorderWidth: 2,
                    pointRadius: 3.5,
                    pointHoverRadius: 5
                }]
            },
            options: {
                animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: false },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(200,195,190,0.9)', lineWidth: 1 },
                        grid: { color: 'rgba(235,230,225,0.8)', circular: false },
                        pointLabels: { font: { size: 12, weight: 500, family: "ui-serif, 'Songti SC', STSong, SimSun, serif" }, color: '#51433C', padding: 12 },
                        ticks: { display: false, min: 0, max: 100 }
                    }
                }
            }
        });
    }

    let generatedImagePayload = null;
    let reportExportInProgress = false;

    function deliverGeneratedImage(dataURL, filename, mobileMessage, returnFocus = null) {
        generatedImagePayload = { dataURL, filename };
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataURL;
            link.click();
            showToast('图片下载已唤起，请确认保存');
            return;
        }
        const overlay = document.getElementById('saveOverlay');
        const overlayImg = document.getElementById('saveOverlayImg');
        const overlayTitle = document.getElementById('saveOverlayTitle');
        const shareLabel = document.getElementById('shareGeneratedLabel');
        overlayImg.src = dataURL;
        overlayTitle.textContent = filename.includes('完整') ? '完整色彩档案已生成' : '专属效果图已生成';
        shareLabel.textContent = typeof navigator.share === 'function' ? '保存或分享' : '保存图片';
        openModal(overlay, overlayTitle, returnFocus);
        setTimeout(() => {
            overlayImg.classList.remove('scale-95');
            overlayImg.classList.add('scale-100');
        }, 10);
        triggerVibration([100, 50, 100]);
        showToast(mobileMessage);
    }

    async function shareGeneratedImage() {
        const payload = generatedImagePayload;
        const button = document.getElementById('shareGeneratedBtn');
        const label = document.getElementById('shareGeneratedLabel');
        if (!payload || !button || !label) return;
        const originalLabel = label.textContent;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        label.textContent = '准备图片…';
        try {
            const blob = await fetch(payload.dataURL).then(response => response.blob());
            const file = new File([blob], payload.filename, { type: blob.type || 'image/jpeg' });
            const shareData = { files: [file], title: '拾色季个人色彩档案' };
            if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
                await navigator.share(shareData);
                showToast('已打开系统保存与分享');
                return;
            }
            const link = document.createElement('a');
            link.download = payload.filename;
            link.href = payload.dataURL;
            link.click();
            showToast('已唤起图片保存');
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error(error);
                showToast('暂时无法打开系统分享，请长按图片保存');
            }
        } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            label.textContent = originalLabel;
        }
    }

    function loadEffectImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
        });
    }

    async function saveEffectImage(kind) {
        if (!['beauty', 'outfit'].includes(kind) || window.personalizedImageState?.[kind] !== 'complete') {
            showCustomAlert('专属效果图尚未完成，请稍后再保存。');
            return;
        }
        const source = kind === 'beauty'
            ? document.getElementById('makeupEditorialAvatar')
            : document.getElementById('outfitEditorialImage');
        const button = document.getElementById(`${kind}EffectSaveBtn`);
        if (!source?.src || !button) return;
        const buttonLabel = button.querySelector('.effect-save-label');
        const original = buttonLabel ? buttonLabel.innerText : button.innerText;
        if (buttonLabel) buttonLabel.innerText = '生成中…';
        else button.innerText = '生成中…';
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        triggerVibration(50);
        try {
            const image = await loadEffectImage(source.src);
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1440;
            const context = canvas.getContext('2d');
            const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);

            const shade = context.createLinearGradient(0, 560, 0, 1440);
            shade.addColorStop(0, 'rgba(45,34,29,0)');
            shade.addColorStop(0.58, 'rgba(45,34,29,0.18)');
            shade.addColorStop(1, 'rgba(45,34,29,0.78)');
            context.fillStyle = shade;
            context.fillRect(0, 0, 1080, 1440);

            context.font = '400 20px sans-serif';
            context.fillStyle = 'rgba(255,255,255,.82)';
            context.fillText(kind === 'beauty' ? '专属妆发设计' : '专属穿搭设计', 72, 1160);
            context.font = '400 66px serif';
            context.fillStyle = '#fff';
            context.fillText(window.currentAnalysisResult?.season_name || '我的专属色彩', 72, 1245);
            context.font = '400 24px sans-serif';
            context.fillStyle = 'rgba(255,255,255,.82)';
            context.fillText(kind === 'beauty' ? '原来我还可以这样美。' : '把适合我的颜色，穿进真实生活。', 72, 1300);

            const colors = Array.isArray(window.currentAnalysisResult?.best_colors)
                ? window.currentAnalysisResult.best_colors.slice(0, 4)
                : [];
            colors.forEach((item, index) => {
                context.fillStyle = typeof item === 'string' ? item : item.hex;
                context.fillRect(72 + index * 74, 1340, 58, 18);
            });
            context.save();
            context.font = '500 20px serif';
            context.fillStyle = 'rgba(255,255,255,.76)';
            context.textAlign = 'right';
            context.fillText('拾色季 · PERSONAL COLOR EDIT', 1008, 1392);
            context.restore();

            const exportLabel = kind === 'beauty' ? '妆发效果图' : '穿搭效果图';
            deliverGeneratedImage(canvas.toDataURL('image/jpeg', .96), `拾色季_${exportLabel}.jpg`, `${exportLabel}已生成，请长按保存`, button);
        } catch (error) {
            console.error(error);
            showCustomAlert('效果图生成失败，请稍后重试。');
        } finally {
            if (buttonLabel) buttonLabel.innerText = original;
            else button.innerText = original;
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    }

    async function saveAsImage() {
        if (reportExportInProgress) {
            showToast('完整档案正在生成，请稍候');
            return;
        }
        if (!isLocalPreview()) {
            const styleStates = Object.values(window.personalizedImageState || {});
            if (styleStates.some((state) => state === 'loading' || state === 'idle')) {
                showCustomAlert('专属妆发与穿搭视觉仍在生成，请完成后再保存完整长图。');
                return;
            }
            if (styleStates.some((state) => state === 'failed')) {
                showCustomAlert('仍有专属视觉未完成，请在对应图片上点击“重试”后再保存完整长图。');
                return;
            }
        }

        const btn = document.getElementById('saveBtn');
        const btnLabel = btn && btn.querySelector('.report-action-label');
        const mainContainer = document.getElementById('mainContainer');
        const captureArea = document.getElementById('captureArea');
        const appContainer = document.querySelector('.app-container');
        if (!btn || !btnLabel || !mainContainer || !captureArea || !appContainer) {
            showCustomAlert('当前页面尚未准备好，请稍后重试。');
            return;
        }

        const originalLabel = btnLabel.textContent;
        const originalLayout = {
            scrollTop: mainContainer.scrollTop,
            appHeight: appContainer.style.height,
            mainOverflow: mainContainer.style.overflow,
            mainHeight: mainContainer.style.height
        };
        let layoutExpanded = false;
        let exportDataURL = '';
        reportExportInProgress = true;
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btnLabel.textContent = '正在整理完整档案…';
        triggerVibration(50);

        try {
            const exportColorSchemes = Array.isArray(window.reportColorStylingSchemes) ? window.reportColorStylingSchemes : [];
            mainContainer.scrollTop = 0;
            appContainer.style.height = 'auto';
            mainContainer.style.overflow = 'visible';
            mainContainer.style.height = 'auto';
            layoutExpanded = true;

            await new Promise(resolve => setTimeout(resolve, 300));
            const preferredScale = window.devicePixelRatio > 1 ? window.devicePixelRatio : 2;
            const dimensionScale = 16384 / Math.max(captureArea.scrollWidth, captureArea.scrollHeight);
            const pixelScale = Math.sqrt(48000000 / Math.max(1, captureArea.scrollWidth * captureArea.scrollHeight));
            const exportScale = Math.max(1, Math.min(preferredScale, dimensionScale, pixelScale));

            const canvas = await html2canvas(captureArea, {
                scale: exportScale,
                useCORS: true,
                backgroundColor: '#F7F5F2',
                logging: false,
                onclone: (doc) => {
                    const cloneArea = doc.getElementById('captureArea');
                    cloneArea.style.padding = '24px 20px';

                    const dimensionDetails = doc.getElementById('dimensionDetails');
                    if (dimensionDetails) dimensionDetails.open = false;

                    const colorStylingTabs = cloneArea.querySelector('.color-styling-tabs');
                    const colorStylingPanel = doc.getElementById('res-color-styling-panel');
                    if (colorStylingTabs) colorStylingTabs.style.display = 'none';
                    if (colorStylingPanel && exportColorSchemes.length) {
                        colorStylingPanel.innerHTML = exportColorSchemes.map((scheme, index) => getColorStylingCardHTML(scheme, index)).join('');
                        colorStylingPanel.style.display = 'grid';
                        colorStylingPanel.style.gap = '14px';
                    }

                    const animatedEls = cloneArea.querySelectorAll('.fade-in, .stagger-1, .stagger-2, .stagger-3, .stagger-4');
                    animatedEls.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; el.style.animation = 'none'; });

                    const glassPanels = cloneArea.querySelectorAll('.glass-panel, .content-card');
                    glassPanels.forEach(el => {
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                        el.style.boxShadow = 'none';
                        el.style.border = '1px solid #E8E1DE';
                        el.style.background = '#FFFFFF';
                    });
                }
            });
            exportDataURL = canvas.toDataURL('image/jpeg', 0.95);
        } catch (error) {
            console.error(error);
            showCustomAlert('完整报告暂时未能生成，页面已恢复。你可以稍后重试，或先使用系统长截屏保存。');
        } finally {
            if (layoutExpanded) {
                appContainer.style.height = originalLayout.appHeight;
                mainContainer.style.overflow = originalLayout.mainOverflow;
                mainContainer.style.height = originalLayout.mainHeight;
                mainContainer.scrollTop = originalLayout.scrollTop;
            }
            reportExportInProgress = false;
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btnLabel.textContent = originalLabel;
        }

        if (exportDataURL) {
            deliverGeneratedImage(exportDataURL, '拾色季_完整色彩档案.jpg', '完整报告已生成，可长按保存或使用系统分享', btn);
        }
    }

    function closeSaveOverlay() {
        triggerVibration(30);
        const overlay = document.getElementById('saveOverlay');
        const overlayImg = document.getElementById('saveOverlayImg');
        overlayImg.classList.remove('scale-100');
        overlayImg.classList.add('scale-95');
        const payloadAtClose = generatedImagePayload;
        closeModal(overlay);
        setTimeout(() => {
            if (generatedImagePayload !== payloadAtClose) return;
            overlayImg.removeAttribute('src');
            generatedImagePayload = null;
        }, 320);
    }

    async function resetTest() {
        triggerVibration(50);
        const code = window.currentCode;
        if (resetVerificationPending) return;

        if (!code) {
            forceKickToHome('登录态已失效，请重新唤醒密钥');
            return;
        }

        const btn = document.querySelector('button[onclick="resetTest()"]');
        const ogText = btn ? btn.innerText : '为朋友开启一份新档案';
        if (btn) {
            btn.innerText = '正在准备下一次分析…';
            btn.classList.add('opacity-70', 'cursor-wait');
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
        }

        let timeoutId = null;
        resetVerificationPending = true;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 12_000);
            const response = await fetch('/api/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activationCode: code }),
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.valid) {
                clearClientWorkflow();
                window.analysisToken = data.analysisToken;
                checkLastReport();
                showStep('step-upload');
                const msg = data.remainingUses !== undefined
                    ? `已准备完成，可生成次数剩余 ${data.remainingUses} 次`
                    : '已准备完成，可以上传新的正面照片';
                showToast(msg);
            } else {
                forceKickToHome(getActivationErrorMessage(response, data));
            }
        } catch (error) {
            console.error(error);
            const message = error?.name === 'AbortError'
                ? '验证等待时间较长，请稍后重新尝试。'
                : '网络连接暂时不可用，请检查网络后重试。';
            showCustomAlert(message);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            resetVerificationPending = false;
            if (btn) {
                btn.innerText = ogText;
                btn.classList.remove('opacity-70', 'cursor-wait');
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
            }
        }
    }

    function forceKickToHome(msg) {
        window.currentCode = '';
        window.analysisToken = '';
        clearClientWorkflow();
        const activationInput = document.getElementById('activationCode');
        if (activationInput) {
            activationInput.disabled = false;
            activationInput.setAttribute('aria-invalid', 'false');
        }
        setActivationStatus('');
        updateActivationSubmitState();
        showStep('step-activation');
        showCustomAlert(msg, activationInput);
    }
