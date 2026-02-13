import { Keystone, loadKeystone, Const } from './vendor/keystone.mjs';

const asmInput = document.getElementById('asmInput');
const hexOutput = document.getElementById('hexOutput');
const archSelect = document.getElementById('archSelect');
const badCharsInput = document.getElementById('badCharsInput');
const byteCountLabel = document.getElementById('byteCount');
const statusBox = document.getElementById('statusBox');
const loadPresetBtn = document.getElementById('loadPresetBtn');


// Presets
const PRESETS = {
    x86: `xor eax, eax
push eax
push 0x68732f2f ; //sh
push 0x6e69622f ; /bin
mov ebx, esp
xor ecx, ecx
xor edx, edx
mov al, 0xb
int 0x80`,
    x64: `xor rax, rax
push rax
mov rdi, 0x68732f6e69622f
push rdi
mov rdi, rsp
xor rsi, rsi
xor rdx, rdx
mov al, 59
syscall`,
    // ARM and MIPS are harder to assemble correctly with minimal Keystone setup, 
    // so we provide "assembled" bytes logic or try best effort. 
    // For now, let's provide standard asm that Keystone MIGHT accept.
    arm: `.code 32
add r3, pc, #1
bx r3
.code 16
mov r0, pc
adds r0, #10
str r0, [sp, #4]
subs r1, r1, r1
str r1, [sp, #8]
ldr r7, [pc, #12]
svc #1
.ascii "/bin/sh"`,
    arm: `.code 32
add r3, pc, #1
bx r3
.code 16
mov r0, pc
adds r0, #10
str r0, [sp, #4]
subs r1, r1, r1
str r1, [sp, #8]
ldr r7, [pc, #12]
svc #1
.ascii "/bin/sh"`
};

async function initKeystone() {
    try {
        statusBox.textContent = "Loading assembler module...";
        statusBox.style.display = 'block';

        await loadKeystone();

        console.log("MIPS Supported:", Keystone.archSupported(Const.KS_ARCH_MIPS));


        statusBox.textContent = "Assembler loaded successfully!";
        statusBox.className = "status-bar status-ok";
        setTimeout(() => statusBox.style.display = 'none', 3000);

        asmInput.placeholder = "; Type your assembly here...";
        assemble();
    } catch (e) {
        console.error("Keystone Init Error", e);
        asmInput.placeholder = "; Error loading assembler.";
        statusBox.textContent = "Error: Could not load Keystone WASM. " + e.message;
        statusBox.className = "status-bar status-error";
        statusBox.style.display = 'block';
    }
}

function getArchConsts(arch) {
    switch (arch) {
        case 'x86': return [Const.KS_ARCH_X86, Const.KS_MODE_32];
        case 'x64': return [Const.KS_ARCH_X86, Const.KS_MODE_64];
        case 'arm': return [Const.KS_ARCH_ARM, Const.KS_MODE_ARM];
        default: return [Const.KS_ARCH_X86, Const.KS_MODE_32];
    }
}

function assemble() {
    const code = asmInput.value;
    const arch = archSelect.value;
    const badCharsStr = badCharsInput.value || "";

    // Parse bad chars
    const badChars = badCharsStr.split(/\s+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));

    // Clear output
    hexOutput.innerHTML = "";

    if (!code.trim()) {
        byteCountLabel.textContent = "0 bytes";
        hexOutput.innerHTML = '<div class="output-line"><span class="line-num">-</span><span class="hex-bytes" style="opacity:0.5">Waiting for input...</span></div>';
        return;
    }

    if (typeof Keystone === 'undefined') {
        hexOutput.innerHTML = '<div class="output-line"><span class="hex-bytes" style="color:var(--red)">Assembler not loaded. API unavailable.</span></div>';
        return;
    }

    try {
        const [archConst, modeConst] = getArchConsts(arch);

        // Create assembler instance
        const k = new Keystone(archConst, modeConst);

        const lines = code.split('\n');
        let totalBytes = 0;

        lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            // Clean line but keep some context if needed. 
            // Assembly often has comments with ;
            const cleanLine = line.split(';')[0].trim();

            let html = `<div class="output-line"><span class="line-num">${lineNum}</span>`;

            if (!cleanLine || cleanLine.startsWith('.') || cleanLine.endsWith(':')) {
                // Directives/Labels or empty
                // Just print a placeholder
                html += `<span class="hex-bytes" style="opacity:0.3">...</span></div>`;
                hexOutput.innerHTML += html;
                return;
            }

            try {
                const result = k.asm(cleanLine);
                const bytes = Array.from(result);
                totalBytes += bytes.length;

                let byteHtml = "";
                bytes.forEach(b => {
                    const hex = b.toString(16).padStart(2, '0').toUpperCase();
                    let cls = "byte-normal"; // Default style

                    if (badChars.includes(b)) {
                        cls = "bad-char";
                    } else if (b === 0) {
                        cls = "byte-null"; // Special color for nulls
                    } else if (b >= 0x20 && b <= 0x7E) {
                        // Printable ASCII (optional styling)
                    }

                    byteHtml += `<span class="${cls}" style="${getColorHeader(cls)}">${hex}</span> `;
                });

                html += `<span class="hex-bytes">${byteHtml}</span></div>`;

            } catch (e) {
                // Assembly failed for this line
                html += `<span class="hex-bytes" style="color:var(--red); font-size:0.85em;">ERROR: ${e.message}</span></div>`;
            }
            hexOutput.innerHTML += html;
        });

        k.close();
        byteCountLabel.textContent = `${totalBytes} bytes`;
        statusBox.style.display = 'none';

    } catch (e) {
        console.error(e);
        statusBox.textContent = "Assembler Critical Error: " + e.message;
        statusBox.className = "status-bar status-error";
        statusBox.style.display = 'block';
    }
}

function getColorHeader(type) {
    if (type === 'bad-char') return 'color:#ff163f; font-weight:bold; text-decoration:underline;';
    if (type === 'byte-null') return 'color:#ff8fa3; opacity:0.8;';
    return 'color:#a9b7c6;';
}

// Event Listeners
asmInput.addEventListener('input', assemble);
archSelect.addEventListener('change', assemble);
badCharsInput.addEventListener('input', assemble);

loadPresetBtn.addEventListener('click', () => {
    asmInput.value = PRESETS[archSelect.value] || "; No preset for this arch";
    assemble();
});

// Start init loop
initKeystone();
