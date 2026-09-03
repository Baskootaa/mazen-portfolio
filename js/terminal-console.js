// ── DEVELOPER TERMINAL CONSOLE ENGINE ──────────────────
(function () {
  const terminalPanel = document.getElementById('terminalPanel');
  const terminalToggle = document.getElementById('terminalToggle');
  const mobileTerminalToggle = document.getElementById('mobileTerminalToggle');
  const terminalCloseBtn = document.getElementById('terminalCloseBtn');
  const terminalOutput = document.getElementById('terminalOutput');
  const terminalInput = document.getElementById('terminalInput');
  const terminalInputGhost = document.getElementById('terminalInputGhost');

  if (!terminalPanel || !terminalInput) return;

  const commands = ['help', 'about', 'skills', 'projects', 'experience', 'contact', 'github', 'reactions', 'coffee', 'coffee++', '3am', 'clear', 'theme', 'cv', 'social', 'secret', 'hack', 'guess'];
  const themes = ['default', 'theme-green', 'theme-cyan', 'theme-amber'];
  let currentThemeIdx = 0;

  const commandHistory = [];
  let historyIdx = 0;
  let activeSubMode = null; // 'projects', 'contact', or 'guess'
  let isTyping = false; // block input while printing typing animations
  let guessTarget = 0;
  let guessAttempts = 0;

  function openTerminalPanel() {
    // Terminal is a desktop experience — never open it on phone-sized screens
    // (covers the command palette / any trigger, not just the mobile menu item).
    if (window.matchMedia('(max-width: 768px)').matches) return;
    terminalPanel.classList.add('open');
    setTimeout(() => {
      terminalInput.focus();
    }, 100);
  }

  function closeTerminalPanel() {
    terminalPanel.classList.remove('open');
    terminalInput.blur();
  }

  if (terminalToggle) terminalToggle.addEventListener('click', openTerminalPanel);
  if (mobileTerminalToggle) {
    mobileTerminalToggle.addEventListener('click', (e) => {
      e.preventDefault();
      // Close mobile menu first
      const navMobile = document.getElementById('navMobile');
      const hamburger = document.getElementById('hamburger');
      if (navMobile) navMobile.classList.remove('open');
      if (hamburger) {
        const spans = hamburger.querySelectorAll('span');
        spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
      openTerminalPanel();
    });
  }
  if (terminalCloseBtn) terminalCloseBtn.addEventListener('click', closeTerminalPanel);

  // ── Resize by dragging the top edge ──
  const resizeHandle = document.getElementById('terminalResizeHandle');
  if (resizeHandle) {
    let dragging = false, startY = 0, startH = 0;
    const MIN_H = 160;
    const maxH = () => Math.round(window.innerHeight * 0.92);

    resizeHandle.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = e.clientY;
      startH = terminalPanel.getBoundingClientRect().height;
      terminalPanel.style.transition = 'none';       // no lag while dragging
      terminalPanel.classList.add('is-resizing');
      document.body.style.userSelect = 'none';
      try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    resizeHandle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      let h = startH + (startY - e.clientY);          // drag up → taller, down → shorter
      h = Math.max(MIN_H, Math.min(maxH(), h));
      terminalPanel.style.height = h + 'px';
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      terminalPanel.style.transition = '';
      terminalPanel.classList.remove('is-resizing');
      document.body.style.userSelect = '';
      try { resizeHandle.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    resizeHandle.addEventListener('pointerup', endDrag);
    resizeHandle.addEventListener('pointercancel', endDrag);
  }

  // Click anywhere in terminal to focus input
  terminalPanel.addEventListener('click', (e) => {
    // If user is selecting text, don't hijack focus
    if (window.getSelection().toString() === '') {
      terminalInput.focus();
    }
  });

  // Print helper
  function printLine(text, className = '') {
    const line = document.createElement('div');
    line.className = 'terminal-line ' + className;
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
    return line;
  }

  // HTML print helper (for special outputs like ASCII art or links)
  function printHTML(html, className = '') {
    const line = document.createElement('div');
    line.className = 'terminal-line ' + className;
    line.innerHTML = html;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
    return line;
  }

  // Typewriter text writer
  function typeText(lineElement, text, speed = 20) {
    return new Promise((resolve) => {
      let idx = 0;
      function write() {
        if (idx < text.length) {
          lineElement.textContent += text.charAt(idx);
          idx++;
          terminalOutput.scrollTop = terminalOutput.scrollHeight;
          setTimeout(write, speed);
        } else {
          resolve();
        }
      }
      write();
    });
  }

  // Progress Bar simulator
  function simulateProgressBar(lineElement, label, speed = 50, blocksCount = 10) {
    return new Promise((resolve) => {
      let current = 0;
      function tick() {
        if (current <= blocksCount) {
          const progress = '█'.repeat(current) + ' '.repeat(blocksCount - current);
          lineElement.textContent = `[${progress}] ${Math.round((current / blocksCount) * 100)}% - ${label}`;
          current++;
          terminalOutput.scrollTop = terminalOutput.scrollHeight;
          setTimeout(tick, speed);
        } else {
          resolve();
        }
      }
      tick();
    });
  }

  // Skills concurrent progress bars
  function animateSkillsBars() {
    const skillList = [
      { name: 'PHP 8 / Laravel', blocks: 9 },
      { name: 'MySQL & Database Design', blocks: 8 },
      { name: 'JavaScript & Web Tech', blocks: 7 },
      { name: 'C# / Python Basics', blocks: 6 },
      { name: 'Git & GitHub', blocks: 8 },
      { name: 'Network Fundamentals', blocks: 7 }
    ];

    const promises = skillList.map(skill => {
      const line = printLine('');
      let current = 0;
      return new Promise(resolve => {
        function frame() {
          if (current <= skill.blocks) {
            const filled = '█'.repeat(current);
            const spaces = ' '.repeat(10 - current);
            line.textContent = `${filled}${spaces} ${skill.name}`;
            current++;
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
            setTimeout(frame, 80 + Math.random() * 40);
          } else {
            resolve();
          }
        }
        frame();
      });
    });

    return Promise.all(promises);
  }

  // Ghost autocomplete helper
  function updateGhostText() {
    const val = terminalInput.value;
    if (val && activeSubMode === null) {
      const match = commands.find(c => c.startsWith(val.toLowerCase()));
      if (match) {
        terminalInputGhost.textContent = val + match.slice(val.length);
      } else {
        terminalInputGhost.textContent = '';
      }
    } else {
      terminalInputGhost.textContent = '';
    }
  }

  terminalInput.addEventListener('input', updateGhostText);

  // Command handlers
  async function handleCommand(cmdStr) {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    printLine(`> ${trimmed}`, 'user-cmd');

    // Add to history
    commandHistory.push(trimmed);
    historyIdx = commandHistory.length;

    const lowerCmd = trimmed.toLowerCase();
    if (activeSubMode && (lowerCmd === 'exit' || lowerCmd === 'quit' || lowerCmd === 'cancel' || lowerCmd === 'q')) {
      printLine(`[EXIT] Exited ${activeSubMode} mode.`, 'info');
      activeSubMode = null;
      terminalInput.value = '';
      terminalInputGhost.textContent = '';
      return;
    }

    // Check sub-modes first
    if (activeSubMode === 'projects') {
      await handleProjectsSelection(trimmed);
      return;
    }
    if (activeSubMode === 'contact') {
      await handleContactSelection(trimmed);
      return;
    }
    if (activeSubMode === 'guess') {
      handleGuessInput(trimmed);
      return;
    }
    if (activeSubMode === 'theme') {
      await handleThemeSelection(trimmed);
      return;
    }

    const args = trimmed.split(' ');
    const cmd = args[0].toLowerCase();

    isTyping = true;
    terminalInput.disabled = true;

    switch (cmd) {
      case 'help':
        const mob = window.innerWidth < 768;
        printLine('Available Commands:', 'banner');
        printLine(mob ? '  about      - Bio'                                     : '  about      - A short biography about me');
        printLine(mob ? '  skills     - Tech stack'                              : '  skills     - Visual display of my core technical stack');
        printLine(mob ? '  projects   - My projects'                             : '  projects   - Interactive list of my built projects');
        printLine(mob ? '  experience - Education history'                        : '  experience - Detailed educational & NTI training history');
        printLine(mob ? '  contact    - Reach out'                               : '  contact    - Channels to reach out or connect with me');
        printLine(mob ? '  github     - Live GitHub stats'                       : '  github     - Live GitHub stats (repos, stars, followers)');
        printLine(mob ? '  reactions  - Project reactions'                       : '  reactions  - Live like/love/star counts per project');
        printLine(mob ? '  cv         - Open resume'                             : '  cv         - Simulates and opens my resume PDF');
        printLine(mob ? '  coffee     - Energize'                                : '  coffee     - Energize the terminal developer');
        printLine(mob ? '  theme      - Change theme'                            : '  theme      - Cycle site themes');
        printLine(mob ? '  social     - GitHub & LinkedIn'                       : '  social     - Quick links to GitHub & LinkedIn');
        printLine(mob ? '  clear      - Clear console'                           : '  clear      - Wipes the console history clean');
        printLine(mob ? '  hack       - Hack sequence'                           : '  hack       - Initiate terminal hack sequence');
        printLine(mob ? '  guess      - Number game'                             : '  guess      - Play a number guessing game');
        printLine(mob ? '  secret     - [LOCKED]'                                : '  secret     - [LOCKED] You need root access first...');
        break;

      case 'about':
        const loadingLine = printLine('', 'loading');
        await typeText(loadingLine, 'Loading bio...', 15);
        await new Promise(r => setTimeout(r, 350));
        loadingLine.remove();

        const aboutLine = printLine('');
        await typeText(aboutLine, "Hi,\nI'm Mazen Albasyouny.\n\nBack-End Developer (PHP/Laravel) studying Computer Science at Mansoura University.\n\nSpecialized in PHP 8, Laravel MVC, MySQL, and RESTful APIs.\nAvailable for Freelance & Backend Roles ✅\n", 15);
        break;

      case 'skills':
        printLine('Loading technical stack visualizer...', 'loading');
        await new Promise(r => setTimeout(r, 400));
        await animateSkillsBars();
        break;

      case 'projects':
        printLine('1. Blood Bank Management System   (Full-Stack Web App)');
        printLine('2. Gym Membership Management System (Subscription & Member Portal)');
        printLine('');
        printLine('Choose project number [1-2]:', 'info');
        activeSubMode = 'projects';
        break;

      case 'experience':
        printLine('National Telecommunication Institute (NTI) - Completed (August 2026)', 'banner');
        printLine('  - Stack: Full-Stack Web Development using PHP & Laravel (120 Hours)');
        printLine('  - Coverage: Laravel MVC, relational databases, PDO, and secure RESTful APIs.');
        printLine('');
        printLine('Faculty of Computers & Information Sciences, Mansoura University', 'banner');
        printLine('  - B.Sc. in Computer Science (Student focusing on software & backend engineering).');
        break;

      case 'contact':
        printLine('Contact Channels:', 'banner');
        printLine('  [email]    - mazen01289elbasyouny@gmail.com');
        printLine('  [linkedin] - Mazen Albasyouny');
        printLine('  [github]   - @Baskootaa');
        printLine('  [phone]    - +20 122 824 9057');
        printLine('');
        printLine('Type target keyword (e.g. github, linkedin, email) to open:', 'info');
        activeSubMode = 'contact';
        break;

      case 'cv':
        const cvLine = printLine('', 'loading');
        await typeText(cvLine, 'Opening Resume...', 20);
        const cvProgress = printLine('');
        await simulateProgressBar(cvProgress, 'Mazen_Albasyouny_CV_Readable.pdf', 80, 10);
        printLine('Done ✔', 'success');
        window.open('Mazen_Albasyouny_CV_Readable.pdf', '_blank');
        break;

      case 'coffee':
        const grindLine = printLine('', 'loading');
        await typeText(grindLine, 'Grinding Beans...', 25);
        const grindProgress = printLine('');
        await simulateProgressBar(grindProgress, 'Grinding', 50, 6);
        
        const brewLine = printLine('', 'loading');
        await typeText(brewLine, '\nBrewing...', 25);
        const brewProgress = printLine('');
        await simulateProgressBar(brewProgress, 'Extraction', 80, 10);
        
        printHTML('<pre style="color:var(--term-accent); font-family: monospace; line-height: 1.2;">\n    (  )   (  )\n     )  )   )  )\n    (__(___(___)\n    |          | ]\n    |          |\n    |__________|\n</pre>');
        printLine('☕ Developer Energy +100', 'success');
        break;

      case 'coffee++':
        printLine('[EASTER EGG] Overclocking coffee module...', 'loading');
        await new Promise(r => setTimeout(r, 600));
        const megaBrewProgress = printLine('');
        await simulateProgressBar(megaBrewProgress, 'MEGA BREW', 40, 12);
        printHTML(String.raw`<pre style="color: #f59e0b; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.3; white-space: pre !important;">  ) ) )
 ( ( (
  ) ) )
..........
|  MEGA  |
| COFFEE | ]
|        |
|________|</pre>`);
        printLine('[WIN] DEVELOPER ENERGY +9999 — MAXIMUM OVERDRIVE', 'success');
        printLine('[WARNING] Productivity levels exceeding safe limits.', 'error');
        if (window.triggerCoffeeOverdrive) window.triggerCoffeeOverdrive();
        document.body.style.transition = 'filter 0.15s';
        document.body.style.filter = 'brightness(1.5)';
        setTimeout(() => { document.body.style.filter = ''; }, 200);
        break;

      case '3am':
        printLine('[EASTER EGG] Simulating 3 AM Midnight Mode...', 'loading');
        await new Promise(r => setTimeout(r, 400));
        if (window.triggerMidnightMode) window.triggerMidnightMode();
        printLine('[SUCCESS] 3 AM Night-Owl Mode Activated!', 'success');
        break;

      case 'clear':
        // Remove all lines except the initial banner header
        Array.from(terminalOutput.children).forEach(el => {
          if (!el.classList.contains('banner')) el.remove();
        });
        break;

      case 'theme': {
        const siteThemes = [
          { id: 'monochrome', name: 'Monochrome Silver' },
          { id: 'gold', name: 'Luxe Gold' },
          { id: 'platinum-gold', name: 'Platinum & Gold Fusion' },
          { id: 'emerald', name: 'Emerald Cyber' }
        ];

        const targetArg = args[1] ? args[1].toLowerCase() : '';

        if (targetArg) {
          let targetObj = null;
          if (targetArg === '1' || targetArg.includes('mono') || targetArg.includes('silver')) {
            targetObj = siteThemes[0];
          } else if (targetArg === '2' || targetArg === 'gold' || targetArg.includes('luxe')) {
            targetObj = siteThemes[1];
          } else if (targetArg === '3' || targetArg.includes('plat') || targetArg.includes('fusion')) {
            targetObj = siteThemes[2];
          } else if (targetArg === '4' || targetArg.includes('em') || targetArg.includes('green')) {
            targetObj = siteThemes[3];
          }

          if (targetObj) {
            applySiteTheme(targetObj);
            break;
          }
        }

       case 'social':
        printHTML('LinkedIn: <a href="https://www.linkedin.com/in/mazen-albasyouny" target="_blank" style="color:var(--term-accent)">Mazen Albasyouny</a>');
        printHTML('GitHub: <a href="https://github.com/Baskootaa" target="_blank" style="color:var(--term-accent)">@Baskootaa</a>');
        break;

      case 'secret':
        if (terminalPanel.classList.contains('access-granted')) {
          printLine('[UNLOCKED] Decryption Successful. Secret Document Unlocked:', 'success');
          printLine('  - Access Level   : Recruiter Mode (Activated)');
          printLine('  - Special Code   : CHIEF_DEVELOPER_MAZEN_2026');
          printLine('  - Objective      : Hire Mazen Albasyouny or schedule an interview!');
          printLine('  - Hidden Feature : Try typing "coffee" or "theme" to customize.');
        } else {
          printLine('[DENIED] Access restricted. Insufficient privileges.', 'error');
          await new Promise(r => setTimeout(r, 400));
          printLine('  HINT: Only a system administrator can unlock this.', 'loading');
          await new Promise(r => setTimeout(r, 400));
          printLine('  HINT: Try running a privileged command... maybe "sudo" something?', 'loading');
          await new Promise(r => setTimeout(r, 400));
          printLine('  HINT: The right action might get someone... employed.', 'loading');
        }
        break;

      case 'hack':
        const hackLine1 = printLine('', 'loading');
        await typeText(hackLine1, 'Initiating hack sequence...', 18);
        await new Promise(r => setTimeout(r, 300));
        const hackLine2 = printLine('', 'loading');
        await typeText(hackLine2, 'Bypassing firewall...', 18);
        await new Promise(r => setTimeout(r, 250));
        const hackLine3 = printLine('', 'loading');
        await typeText(hackLine3, 'Injecting payload...', 18);
        await new Promise(r => setTimeout(r, 300));
        const hackLine4 = printLine('', 'loading');
        await typeText(hackLine4, 'Decrypting database...', 18);
        await new Promise(r => setTimeout(r, 400));
        printLine('[ERROR 403] Target is Mazen Albasyouny. Hack Aborted.', 'error');
        printLine('[REASON]   Developer too good to be hacked.', 'error');
        break;

      case 'guess':
        guessTarget = Math.floor(Math.random() * 100) + 1;
        guessAttempts = 0;
        printLine('[GAME] Number Guessing — started!', 'banner');
        printLine(`I'm thinking of a number between 1 and 100.`);
        printLine('Type your guess and press Enter:');
        activeSubMode = 'guess';
        break;

      case 'sudo':
        if (args.slice(1).join(' ').toLowerCase() === 'hire mazen') {
          terminalPanel.classList.add('access-granted');
          printLine('Access Granted.', 'success');
          printLine('Welcome Recruiter.', 'success');
          printHTML(String.raw`<pre style="font-family: 'JetBrains Mono', Consolas, Monaco, 'Courier New', Courier, monospace !important; font-size: 11px; line-height: 1.35; margin-top: 8px; white-space: pre !important;">  
 ____    _    ____  _  _______  _____  _    
| __ )  / \  / ___|| |/ / ____|/ _ \  / \   
|  _ \ / _ \ \___ \| ' /|  _| | | | |/ _ \  
| |_) / ___ \ ___) | . \| |___| |_| / ___ \ 
|____/_/   \_\____/|_|\_\_____|\___/_/   \_\
                                            </pre>`);
          triggerConfettiEffect();
        } else {
          printLine('Access Denied', 'error');
        }
        break;

      case 'github': {
        printLine('Fetching live GitHub stats...', 'loading');
        try {
          const res = await fetch('/api/github', { headers: { Accept: 'application/json' } });
          const d = await res.json();
          if (d && !d.error) {
            printLine(`@${d.login}${d.name ? ' — ' + d.name : ''}`, 'banner');
            printLine(`  Public Repos : ${d.repos}`);
            printLine(`  Total Stars  : ${d.stars}`);
            printLine(`  Followers    : ${d.followers}`);
            if (Array.isArray(d.top) && d.top.length) {
              printLine('  Top repos    :');
              d.top.slice(0, 3).forEach(rp => printLine(`    - ${rp.name} (${rp.stars} stars)`));
            }
            printHTML('Profile: <a href="https://github.com/Baskootaa" target="_blank" style="color:var(--term-accent)">github.com/Baskootaa</a>');
          } else {
            printLine('Could not reach GitHub right now.', 'error');
          }
        } catch (e) { printLine('Could not reach GitHub right now.', 'error'); }
        break;
      }

      case 'reactions': {
        printLine('Loading live project reactions...', 'loading');
        try {
          const res = await fetch('/api/reactions', { headers: { Accept: 'application/json' } });
          const d = await res.json();
          if (d && d.reactions) {
            const names = { 'blood-bank': 'Blood Bank', 'gym-membership': 'Gym Membership' };
            printLine('Live Project Reactions:', 'banner');
            Object.keys(d.reactions).forEach(p => {
              const c = d.reactions[p];
              printLine(`  ${(names[p] || p).padEnd(18)} like ${c.like}  ·  love ${c.love}  ·  star ${c.star}`);
            });
            printLine('React on the Projects section!', 'info');
          } else {
            printLine('Reactions are not available right now.', 'error');
          }
        } catch (e) { printLine('Could not load reactions.', 'error'); }
        break;
      }

      default:
        printLine(`command not found: "${cmd}". Type "help" to see available commands.`, 'error');
        break;
    }

    isTyping = false;
    terminalInput.disabled = false;
    terminalInput.value = '';
    terminalInputGhost.textContent = '';
    
    // Maintain focus
    setTimeout(() => {
      terminalInput.focus();
    }, 10);
  }

  function applySiteTheme(targetObj) {
    document.documentElement.setAttribute('data-theme', targetObj.id);
    localStorage.setItem('mazen-portfolio-theme', targetObj.id);

    document.querySelectorAll('.theme-option-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeId === targetObj.id);
    });

    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: targetObj.id } }));
    printLine(`Site theme successfully set to: ${targetObj.name} ✨`, 'success');
  }

  async function handleThemeSelection(input) {
    const trimmed = input.trim().toLowerCase();
    activeSubMode = null; // reset state
    terminalInput.value = '';
    terminalInputGhost.textContent = '';

    if (trimmed === 'cancel' || trimmed === 'exit' || trimmed === 'q') {
      printLine('Theme selection cancelled.', 'info');
      return;
    }

    const siteThemes = [
      { id: 'monochrome', name: 'Monochrome Silver' },
      { id: 'gold', name: 'Luxe Gold' },
      { id: 'platinum-gold', name: 'Platinum & Gold Fusion' },
      { id: 'emerald', name: 'Emerald Cyber' }
    ];

    let selectedObj = null;
    if (trimmed === '1' || trimmed.includes('mono') || trimmed.includes('silver')) {
      selectedObj = siteThemes[0];
    } else if (trimmed === '2' || trimmed === 'gold' || trimmed.includes('luxe')) {
      selectedObj = siteThemes[1];
    } else if (trimmed === '3' || trimmed.includes('plat') || trimmed.includes('fusion')) {
      selectedObj = siteThemes[2];
    } else if (trimmed === '4' || trimmed.includes('em') || trimmed.includes('green')) {
      selectedObj = siteThemes[3];
    }

    if (!selectedObj) {
      printLine('Invalid choice. Type 1, 2, 3, 4, or theme name (or "cancel"):', 'error');
      activeSubMode = 'theme'; // keep submode active for retry
      return;
    }

    applySiteTheme(selectedObj);
  }

  // Handle Projects mode selection
  async function handleProjectsSelection(choice) {
    activeSubMode = null; // reset state
    terminalInput.value = '';
    terminalInputGhost.textContent = '';

    if (choice === '1') {
      printLine('Blood Bank Management System — Full-Stack Web App', 'banner');
      printLine('Status: Live & Shipped');
      printLine('Tech Stack: PHP, Laravel, MySQL, React.js, Tailwind CSS');
      printLine('Features: Blood donor connections, emergency requests tracking, donor management & interactive dashboards.');
      printHTML('Live Site: <a href="https://blood-bank-rho-two.vercel.app" target="_blank" style="color:var(--term-accent)">Blood Bank Live Link</a>');
      printHTML('GitHub:  <a href="https://github.com/Baskootaa/BloodBank" target="_blank" style="color:var(--term-accent)">github.com/Baskootaa/BloodBank</a>');
    } else if (choice === '2') {
      printLine('Gym Membership Management System — Subscription & Admin Portal', 'banner');
      printLine('Status: Live & Shipped');
      printLine('Tech Stack: PHP, PDO, MySQL, Bootstrap, JavaScript');
      printLine('Features: Subscription expiration monitoring, member renewals, and automated invoicing.');
      printHTML('GitHub:  <a href="https://github.com/Baskootaa" target="_blank" style="color:var(--term-accent)">github.com/Baskootaa</a>');
    } else {
      printLine('Invalid selection. Exited project selector.', 'error');
    }

    setTimeout(() => {
      terminalInput.focus();
    }, 10);
  }

  // Handle Contact mode selection
  async function handleContactSelection(choice) {
    activeSubMode = null;
    terminalInput.value = '';
    terminalInputGhost.textContent = '';

    const cleaned = choice.toLowerCase().trim();
    if (cleaned === 'github') {
      printLine('Opening GitHub profile...', 'success');
      window.open('https://github.com/Baskootaa', '_blank');
    } else if (cleaned === 'linkedin') {
      printLine('Opening LinkedIn profile...', 'success');
      window.open('https://www.linkedin.com/in/mazen-albasyouny', '_blank');
    } else if (cleaned === 'email') {
      printLine('Opening mail client...', 'success');
      window.open('mailto:mazen01289elbasyouny@gmail.com', '_blank');
    } else {
      printLine('Unknown contact keyword. Exited contact selector.', 'error');
    }

    setTimeout(() => { terminalInput.focus(); }, 10);
  }

  // Handle Guess Game mode
  function handleGuessInput(input) {
    const lower = input.trim().toLowerCase();
    if (lower === 'exit' || lower === 'quit' || lower === 'cancel' || lower === 'q') {
      printLine('[EXIT] Exited guessing game.', 'info');
      activeSubMode = null;
      terminalInput.value = '';
      terminalInputGhost.textContent = '';
      return;
    }

    const num = parseInt(input.trim());
    if (isNaN(num) || num < 1 || num > 100) {
      printLine('Please enter a valid number between 1 and 100 (or type "exit" to quit).', 'error');
      terminalInput.value = '';
      terminalInputGhost.textContent = '';
      return;
    }
    guessAttempts++;
    if (num === guessTarget) {
      printLine(`[WIN] Correct! Guessed in ${guessAttempts} attempt${guessAttempts > 1 ? 's' : ''}.`, 'success');
      printLine('Type "guess" to play again anytime.');
      activeSubMode = null;
    } else if (num < guessTarget) {
      printLine('[^] Too low!  Go higher.', 'loading');
    } else {
      printLine('[v] Too high! Go lower.', 'loading');
    }
    terminalInput.value = '';
    terminalInputGhost.textContent = '';
    setTimeout(() => { terminalInput.focus(); }, 10);
  }

  // Trigger visual confetti effect on recruiter hire
  function triggerConfettiEffect() {
    const duration = 3000;
    const end = Date.now() + duration;
    
    const colors = ['#10b981', '#34d399', '#a78bfa', '#06b6d4', '#fbbf24', '#f472b6'];

    function frame() {
      if (Date.now() > end) return;
      
      const particle = document.createElement('div');
      particle.style.position = 'fixed';
      particle.style.width = Math.random() * 8 + 4 + 'px';
      particle.style.height = Math.random() * 8 + 4 + 'px';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = Math.random() * window.innerWidth + 'px';
      particle.style.bottom = '0px';
      particle.style.zIndex = '99999';
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';

      document.body.appendChild(particle);

      let velocityY = Math.random() * -12 - 6;
      let velocityX = (Math.random() - 0.5) * 6;
      let posY = window.innerHeight;
      let posX = parseFloat(particle.style.left);

      function update() {
        velocityY += 0.35; // gravity
        posY += velocityY;
        posX += velocityX;
        particle.style.top = posY + 'px';
        particle.style.left = posX + 'px';

        if (posY < window.innerHeight + 20) {
          requestAnimationFrame(update);
        } else {
          particle.remove();
        }
      }
      update();

      setTimeout(frame, 40);
    }
    frame();
  }

  // Key Event Handling
  terminalInput.addEventListener('keydown', (e) => {
    if (isTyping) {
      e.preventDefault();
      return;
    }

    // Enter Key
    if (e.key === 'Enter') {
      const val = terminalInput.value;
      handleCommand(val);
      return;
    }

    // Up Arrow
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      if (historyIdx > 0) {
        historyIdx--;
        terminalInput.value = commandHistory[historyIdx];
        updateGhostText();
      }
      return;
    }

    // Down Arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < commandHistory.length - 1) {
        historyIdx++;
        terminalInput.value = commandHistory[historyIdx];
        updateGhostText();
      } else {
        historyIdx = commandHistory.length;
        terminalInput.value = '';
        updateGhostText();
      }
      return;
    }

    // Tab Key
    if (e.key === 'Tab') {
      e.preventDefault();
      if (activeSubMode !== null) return;
      const val = terminalInput.value;
      if (val) {
        const match = commands.find(c => c.startsWith(val.toLowerCase()));
        if (match) {
          terminalInput.value = match;
          updateGhostText();
        }
      }
    }
  });
})();
