// Flamingo Student App — Supabase authentication + student card
const SUPABASE_URL = "https://cvfzigtkdskjshhaelyb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qJSCx9ImKiHzVEKf9u42UA_JT-_LBlk";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const submitBtn = document.getElementById("submitBtn");
const switchMode = document.getElementById("switchMode");
const switchText = document.getElementById("switchText");
const fullName = document.getElementById("fullName");
const nameLabel = document.getElementById("nameLabel");
const authMessage = document.getElementById("authMessage");
const profileForm = document.getElementById("profileForm");
let isSignUp = false;
let currentUser = null;
let qrScanner = null;
let scannerRunning = false;
let rewardsRefreshTimer = null;
let wheelPromptShown = false;

document.getElementById("year").textContent = new Date().getFullYear();

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#a33b35" : "#8c5246";
}

function formatExperienceDate(value, includeTime = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const options = {
    timeZone: "Africa/Tunis",
    day: "numeric",
    month: "short",
    year: "numeric"
  };
  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

function experienceSchedule(item, kind) {
  const start = formatExperienceDate(item.starts_at, kind === "event");
  const end = formatExperienceDate(item.ends_at, kind === "event");
  if (start && end) return start + " — " + end;
  if (start) return kind === "offer" ? "Available from " + start : start;
  if (end) return "Until " + end;
  return "";
}

function safeExperienceImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch (_) {
    return null;
  }
}

function showExperienceEmpty(container, kind, unavailable = false) {
  const empty = document.createElement("div");
  empty.className = "experience-empty";
  const mark = document.createElement("span");
  mark.className = "experience-empty-mark";
  mark.textContent = kind === "offer" ? "✦" : "♧";
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  const detail = document.createElement("p");
  if (unavailable) {
    heading.textContent = "Content is temporarily unavailable";
    detail.textContent = "Please try again later.";
  } else if (kind === "offer") {
    heading.textContent = "No student offers published yet";
    detail.textContent = "New Flamingo student benefits will appear here when they are announced.";
  } else {
    heading.textContent = "No upcoming events published yet";
    detail.textContent = "Flamingo events will appear here as soon as dates and details are confirmed.";
  }
  copy.append(heading, detail);
  empty.append(mark, copy);
  container.replaceChildren(empty);
}

function createExperienceCard(item, kind) {
  const card = document.createElement("article");
  card.className = "experience-card";

  const image = document.createElement("div");
  image.className = "experience-image is-placeholder";
  const placeholderMark = document.createElement("span");
  placeholderMark.className = "experience-placeholder-mark";
  placeholderMark.textContent = kind === "offer" ? "✦" : "♧";
  const placeholderLabel = document.createElement("span");
  placeholderLabel.className = "experience-placeholder-label";
  placeholderLabel.textContent = "FLAMINGO · VISUAL COMING SOON";
  image.append(placeholderMark, placeholderLabel);

  const imageUrl = safeExperienceImageUrl(item.image_url);
  if (imageUrl) {
    const photo = document.createElement("img");
    photo.src = imageUrl;
    photo.alt = (item.title || (kind === "offer" ? "Student offer" : "Flamingo event")) + " image";
    photo.loading = "lazy";
    photo.decoding = "async";
    photo.addEventListener("load", () => image.classList.remove("is-placeholder"), { once: true });
    photo.addEventListener("error", () => {
      photo.remove();
      image.classList.add("is-placeholder");
    }, { once: true });
    image.appendChild(photo);
  }

  const body = document.createElement("div");
  body.className = "experience-card-body";
  const top = document.createElement("div");
  top.className = "experience-card-top";
  const type = document.createElement("span");
  type.className = "experience-type";
  type.textContent = kind === "offer" ? "STUDENT OFFER" : "FLAMINGO EVENT";
  top.appendChild(type);

  if (kind === "offer" && item.discount_label) {
    const highlight = document.createElement("span");
    highlight.className = "experience-highlight";
    highlight.textContent = item.discount_label;
    top.appendChild(highlight);
  }

  const title = document.createElement("h3");
  title.textContent = item.title || (kind === "offer" ? "Student offer" : "Flamingo event");
  body.append(top, title);

  if (item.description && String(item.description).trim()) {
    const description = document.createElement("p");
    description.className = "experience-card-description";
    description.textContent = item.description;
    body.appendChild(description);
  }

  const details = document.createElement("div");
  details.className = "experience-details";
  const schedule = experienceSchedule(item, kind);
  if (schedule) {
    const date = document.createElement("span");
    date.className = "experience-detail";
    const icon = document.createElement("span");
    icon.className = "experience-detail-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "◷";
    const label = document.createElement("span");
    label.textContent = schedule;
    date.append(icon, label);
    details.appendChild(date);
  }
  if (kind === "event" && item.location) {
    const location = document.createElement("span");
    location.className = "experience-detail";
    const icon = document.createElement("span");
    icon.className = "experience-detail-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌖";
    const label = document.createElement("span");
    label.textContent = item.location;
    location.append(icon, label);
    details.appendChild(location);
  }
  if (details.childElementCount) body.appendChild(details);

  card.append(image, body);
  return card;
}

async function loadExperienceSection(tableName, containerId, kind) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();

  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select("id, title, description, image_url, discount_label, starts_at, ends_at, location")
      .eq("is_active", true)
      .order("starts_at", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const items = Array.isArray(data) ? data : [];
    if (!items.length) {
      showExperienceEmpty(container, kind);
      return;
    }
    items.forEach((item) => container.appendChild(createExperienceCard(item, kind)));
  } catch (error) {
    console.warn("Could not load " + kind + " content:", error.message || error);
    showExperienceEmpty(container, kind, true);
  }
}

async function loadOffersAndEvents() {
  await Promise.all([
    loadExperienceSection("offers", "offersGrid", "offer"),
    loadExperienceSection("events", "eventsGrid", "event")
  ]);
}

function renderCouponGrid(progress) {
  const grid = document.getElementById("couponGrid");
  if (!grid) return;
  const slots = grid.querySelectorAll(".coupon-slot");
  slots.forEach((slot, index) => {
    const collected = index < progress;
    slot.classList.toggle("is-collected", collected);
    slot.replaceChildren();
    if (collected) {
      const logo = document.createElement("img");
      logo.src = "./logo.png";
      logo.alt = "Flamingo";
      logo.className = "coupon-logo";
      slot.appendChild(logo);
      slot.setAttribute("aria-label", "Coupon " + (index + 1) + " collected");
    } else {
      slot.textContent = String(index + 1);
      slot.setAttribute("aria-label", "Coupon " + (index + 1) + " not collected");
    }
  });
}

function setMode(signUp) {
  isSignUp = signUp;
  fullName.classList.toggle("hidden", !signUp);
  nameLabel.classList.toggle("hidden", !signUp);
  fullName.required = signUp;
  authTitle.textContent = signUp ? "Create your account" : "Student sign in";
  authSubtitle.textContent = signUp ? "Join the Flamingo student community." : "Sign in to access your student space.";
  submitBtn.innerHTML = signUp ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  switchText.textContent = signUp ? "Already a member?" : "New to Flamingo?";
  switchMode.textContent = signUp ? "Sign in" : "Create account";
  document.getElementById("password").autocomplete = signUp ? "new-password" : "current-password";
  setMessage(authMessage, "");
}

switchMode.addEventListener("click", () => setMode(!isSignUp));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  submitBtn.disabled = true;
  setMessage(authMessage, isSignUp ? "Creating your account…" : "Signing you in…");
  try {
    if (isSignUp) {
      const { data, error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { full_name: fullName.value.trim() } }
      });
      if (error) throw error;
      if (data.session) await showApp(data.user);
      else setMessage(authMessage, "Account created. Please sign in to continue.");
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await showApp(data.user);
    }
  } catch (error) {
    setMessage(authMessage, error.message || "Something went wrong. Please try again.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

async function showApp(user) {
  currentUser = user;
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  document.getElementById("userName").textContent = user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
  await loadStudentData();
  await loadRewards();
  await checkFlamingoAdmin();
  const adminVisible = !document.getElementById("adminPanel")?.classList.contains("hidden");
  const phoneDigits = (document.getElementById("profilePhone")?.value || "").replace(/\D/g, "");
  const profileReady = Boolean(
    document.getElementById("profileName")?.value.trim() &&
    phoneDigits.length >= 8 && phoneDigits.length <= 15 &&
    document.getElementById("profileUniversity")?.value.trim() &&
    document.getElementById("profileLevel")?.value.trim()
  );
  appView.classList.toggle("profile-setup-mode", !adminVisible && !profileReady);
  if (!adminVisible && !profileReady) {
    setMessage(document.getElementById("profileMessage"), "Welcome to Flamingo! Complete your student information to activate your Student Card.");
    requestAnimationFrame(() => {
      document.getElementById("profileName")?.focus({ preventScroll: true });
      document.getElementById("profileForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  await loadOffersAndEvents();
  if (rewardsRefreshTimer) clearInterval(rewardsRefreshTimer);
  rewardsRefreshTimer = setInterval(() => { if (currentUser) loadRewards({ autoOpen: true }); }, 8000);
}

async function checkFlamingoAdmin() {
  const adminPanel = document.getElementById("adminPanel");
  if (!currentUser || !adminPanel) return;
  adminPanel.classList.add("hidden");
  document.getElementById("navScan")?.classList.add("hidden");
  document.getElementById("scannerSection")?.classList.add("hidden");

  if ((currentUser.email || "").toLowerCase() === "azizmarouch14@gmail.com") {
    const { data, error } = await supabaseClient.rpc("claim_flamingo_admin");
    if (error) {
      console.error("Flamingo admin setup:", error.message);
      return;
    }
    if (data === true) {
      adminPanel.classList.remove("hidden");
      document.getElementById("navScan")?.classList.remove("hidden");
      document.getElementById("scannerSection")?.classList.remove("hidden");
      document.getElementById("adminEmail").textContent = currentUser.email;
      await loadAdminStats();
    }
    return;
  }

  const { data, error } = await supabaseClient.rpc("is_flamingo_staff");
  if (!error && data === true) {
    adminPanel.classList.remove("hidden");
    document.getElementById("navScan")?.classList.remove("hidden");
    document.getElementById("scannerSection")?.classList.remove("hidden");
    document.getElementById("adminEmail").textContent = currentUser.email || "Staff account";
    await loadAdminStats();
  }
}


async function loadAdminStats() {
  const status = document.getElementById("statsMessage");
  try {
    setMessage(status, "Loading dashboard statistics…");
    const { data, error } = await supabaseClient.rpc("get_flamingo_admin_stats");
    if (error) throw error;
    const values = {
      statTotalUsers: data.total_users,
      statNewToday: data.new_users_today,
      statNewWeek: data.new_users_7d,
      statProfiles: data.total_profiles,
      statActiveCards: data.active_cards,
      statTotalScans: data.total_scans
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = Number(value ?? 0).toLocaleString("en-US");
    });
    setMessage(status, "Statistics updated.");
  } catch (error) {
    setMessage(status, error.message || "Could not load admin statistics.", true);
  }
}

const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
toggleHistoryBtn?.addEventListener("click", async () => {
  const content = document.getElementById("historyContent");
  if (!content) return;
  const opening = content.classList.contains("hidden");
  content.classList.toggle("hidden", !opening);
  toggleHistoryBtn.textContent = opening ? "Hide history ↑" : "View history ↓";
  toggleHistoryBtn.setAttribute("aria-expanded", String(opening));
  if (opening) await loadScanHistory();
});

async function loadScanHistory() {
  const body = document.getElementById("scanHistoryBody");
  const status = document.getElementById("historyMessage");
  const refresh = document.getElementById("refreshHistoryBtn");
  if (!body || !currentUser) return;
  if (refresh) refresh.disabled = true;
  setMessage(status, "Loading scan history…");
  try {
    const { data, error } = await supabaseClient.functions.invoke("verify-student-card", {
      body: { action: "history" }
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.history)) throw new Error(data?.error || "Could not load history.");
    body.replaceChildren();
    if (!data.history.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "No card scans recorded yet.";
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      data.history.forEach((entry) => {
        const row = document.createElement("tr");
        const student = document.createElement("td");
        const studentName = document.createElement("strong");
        studentName.textContent = entry.full_name || "Student";
        const cardId = document.createElement("small");
        cardId.textContent = entry.member_id || "—";
        student.append(studentName, cardId);

        const time = document.createElement("td");
        time.textContent = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Tunis", dateStyle: "medium", timeStyle: "short"
        }).format(new Date(entry.scanned_at));

        const visits = document.createElement("td");
        visits.textContent = String(entry.visit_count ?? 0);

        const state = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "history-status " + (entry.scan_status === "active" ? "is-active" : "is-inactive");
        pill.textContent = (entry.scan_status || "unknown").toUpperCase();
        state.appendChild(pill);
        row.append(student, time, visits, state);
        body.appendChild(row);
      });
    }
    setMessage(status, data.history.length + " recent scan(s) loaded.");
  } catch (error) {
    setMessage(status, error.message || "Could not load scan history.", true);
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

document.getElementById("refreshHistoryBtn")?.addEventListener("click", loadScanHistory);

async function startStudentScanner() {
  const resultBox = document.getElementById("scanResult");
  const startButton = document.getElementById("startScannerBtn");
  const stopButton = document.getElementById("stopScannerBtn");
  if (!window.Html5Qrcode) {
    setMessage(resultBox, "Scanner library could not load. Refresh the page and try again.", true);
    return;
  }
  if (scannerRunning) return;

  qrScanner = new Html5Qrcode("qrReader");
  startButton.disabled = true;
  setMessage(resultBox, "Requesting camera access…");
  try {
    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 230, height: 230 } },
      async (decodedText) => {
        await stopStudentScanner();
        await verifyScannedCard(decodedText);
      },
      () => {}
    );
    scannerRunning = true;
    stopButton.classList.remove("hidden");
    setMessage(resultBox, "Camera active. Point it at a student's QR code.");
  } catch (error) {
    setMessage(resultBox, error.message || "Could not access the camera. Check browser permissions.", true);
  } finally {
    startButton.disabled = false;
  }
}

async function stopStudentScanner() {
  const stopButton = document.getElementById("stopScannerBtn");
  if (qrScanner && scannerRunning) {
    try { await qrScanner.stop(); } catch (error) { console.warn("Scanner stop:", error); }
    try { qrScanner.clear(); } catch (_) {}
  }
  scannerRunning = false;
  qrScanner = null;
  stopButton.classList.add("hidden");
}

async function verifyScannedCard(qrToken) {
  const resultBox = document.getElementById("scanResult");
  setMessage(resultBox, "Checking student membership…");
  try {
    const { data, error } = await supabaseClient.functions.invoke("verify-student-card", {
      body: { qr_token: qrToken }
    });
    if (error) throw error;
    if (!data) throw new Error("No verification response received.");

    resultBox.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = data.valid ? "VALIDE" : (data.status || "NOT VERIFIED").toUpperCase();
    if (data.valid) {
      heading.style.color = "#218838";
      heading.style.fontSize = "20px";
      heading.style.fontWeight = "800";
    }
    const name = document.createElement("span");
    name.textContent = data.full_name || "Unknown student";
    const member = document.createElement("span");
    member.textContent = data.member_id ? "Member ID: " + data.member_id : "";
    const university = document.createElement("span");
    university.textContent = [data.university, data.study_level].filter(Boolean).join(" · ");
    const message = document.createElement("span");
    message.textContent = data.message || "Verification complete";
    const visits = document.createElement("span");
    visits.textContent = "Total visits: " + (data.visit_count ?? 0) + " · Coupons: " + (data.coupon_progress ?? 0) + "/10 · Free coffees: " + (data.free_coffees_available ?? 0);
    const couponPreview = document.createElement("div");
    couponPreview.className = "scan-coupon-grid";
    const couponProgress = Number(data.coupon_progress || 0);
    for (let i = 0; i < 10; i++) {
      const slot = document.createElement("span");
      slot.className = "coupon-slot" + (i < couponProgress ? " is-collected" : "");
      if (i < couponProgress) {
        const logo = document.createElement("img");
        logo.src = "./logo.png";
        logo.alt = "Flamingo";
        logo.className = "coupon-logo";
        slot.appendChild(logo);
      } else {
        slot.textContent = String(i + 1);
      }
      couponPreview.appendChild(slot);
    }
    resultBox.append(heading, name, member, university, visits, couponPreview, message);
    if (data.valid) await loadScanHistory();
    resultBox.className = "scan-result " + (data.valid ? "scan-valid" : "scan-invalid");
  } catch (error) {
    resultBox.className = "scan-result scan-invalid";
    setMessage(resultBox, error.message || "Could not verify this QR code.", true);
  }
}

document.querySelectorAll("#studentNav .nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll("#studentNav .nav-item").forEach((navItem) => navItem.classList.remove("active"));
    item.classList.add("active");
  });
});

document.getElementById("navScan")?.addEventListener("click", () => {
  document.getElementById("scannerSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("startScannerBtn")?.addEventListener("click", startStudentScanner);
document.getElementById("stopScannerBtn")?.addEventListener("click", stopStudentScanner);


async function loadRewards(options = {}) {
  const { data, error } = await supabaseClient.functions.invoke("student-rewards", { body: { action: "dashboard" } });
  if (error || !data) { setMessage(document.getElementById("wheelMessage"), error?.message || "Could not load rewards.", true); return; }
  document.getElementById("pointsTotal").textContent = String(data.balance || 0);
  const progress = Number(data.visits?.coupon_progress || 0);
  document.getElementById("couponProgress").textContent = progress + "/10";
  document.getElementById("freeCoffees").textContent = String(data.visits?.free_coffees_available || 0);
  renderCouponGrid(progress);
  const canSpin = data.can_spin === true;
  document.getElementById("spinWheelBtn").disabled = !canSpin || wheelIsAnimating;
  const wheelSection = document.getElementById("rewardsSection");
  if (canSpin && options.autoOpen && !wheelPromptShown && wheelSection) {
    wheelPromptShown = true;
    wheelSection.classList.add("wheel-ready");
    wheelSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (!canSpin) {
    wheelPromptShown = false;
    wheelSection?.classList.remove("wheel-ready");
  }
  setMessage(document.getElementById("wheelMessage"), canSpin ? "Your valid visit unlocked one spin!" : "A valid visit is required to unlock your next spin.");
  const shop = document.getElementById("rewardShopItems"); shop.replaceChildren();
  if (!data.items?.length) { const p=document.createElement("p"); p.className="shop-empty"; p.textContent="Rewards will appear here soon. Flamingo staff will add the gifts."; shop.appendChild(p); }
  else data.items.forEach(item => {
    const card=document.createElement("div"); card.className="shop-item";
    const info=document.createElement("div"), title=document.createElement("strong"), desc=document.createElement("small");
    title.textContent=item.name; desc.textContent=item.description || "Flamingo reward"; info.append(title,desc);
    const btn=document.createElement("button"); btn.type="button"; btn.className="redeem-btn"; btn.textContent=item.points_cost+" pts · Redeem"; btn.disabled=Number(data.balance||0)<Number(item.points_cost);
    btn.addEventListener("click",()=>redeemShopItem(item.id)); card.append(info,btn); shop.appendChild(card);
  });
}
async function redeemShopItem(itemId) {
  const msg=document.getElementById("shopMessage"); setMessage(msg,"Redeeming your reward…");
  try { const {data,error}=await supabaseClient.functions.invoke("student-rewards",{body:{action:"redeem",item_id:itemId}}); if(error) throw error; if(!data?.ok) throw new Error(data?.message||"Could not redeem.");
    setMessage(msg,"Reward reserved! Show your app to Flamingo staff to collect it."); await loadRewards();
  } catch(e) { setMessage(msg,e.message||"Could not redeem.",true); }
}
let wheelIsAnimating = false;
let wheelAudioContext = null;

function playRewardSound(isWin) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    wheelAudioContext = wheelAudioContext || new AudioContextClass();
    if (wheelAudioContext.state === "suspended") wheelAudioContext.resume();
    const notes = isWin ? [523.25, 659.25, 783.99, 1046.5] : [392, 493.88, 587.33];
    const start = wheelAudioContext.currentTime;
    notes.forEach((frequency, index) => {
      const oscillator = wheelAudioContext.createOscillator();
      const gain = wheelAudioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + index * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.13, start + index * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.13 + 0.22);
      oscillator.connect(gain);
      gain.connect(wheelAudioContext.destination);
      oscillator.start(start + index * 0.13);
      oscillator.stop(start + index * 0.13 + 0.24);
    });
  } catch (error) {
    console.info("Reward sound unavailable:", error);
  }
}

function celebrateReward() {
  const layer = document.createElement("div");
  layer.className = "reward-confetti";
  layer.setAttribute("aria-hidden", "true");
  const pieces = ["#d5ad70", "#a86d60", "#35151f", "#f4dfc6", "#ffffff"];
  for (let i = 0; i < 54; i++) {
    const piece = document.createElement("i");
    piece.style.left = (Math.random() * 100) + "%";
    piece.style.background = pieces[i % pieces.length];
    piece.style.setProperty("--fall-duration", (2.1 + Math.random() * 1.8) + "s");
    piece.style.setProperty("--fall-delay", (Math.random() * 0.45) + "s");
    piece.style.setProperty("--drift", ((Math.random() - 0.5) * 180) + "px");
    piece.style.setProperty("--spin", (Math.random() * 900 - 450) + "deg");
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 4600);
}
function animateRewardWheel(pointsAwarded) {
  return new Promise((resolve) => {
    const wheel = document.getElementById("wheelGraphic");
    if (!wheel) return resolve();
    const sectorAngles = [0, 60, 120, 180, 240, 300];
    const sector = Math.max(0, Math.min(5, Number(wheel.dataset.winningSector || 0)));
    const current = Number(wheel.dataset.rotation || 0);
    const target = current + 360 * 6 + ((360 - ((current + sectorAngles[sector]) % 360)) % 360);
    wheel.dataset.rotation = String(target);
    wheel.classList.add("is-spinning");
    const finish = () => {
      wheel.classList.remove("is-spinning");
      wheel.removeEventListener("transitionend", finish);
      resolve();
    };
    wheel.addEventListener("transitionend", finish, { once: true });
    wheel.style.transform = "rotate(" + target + "deg)";
    window.setTimeout(finish, 6500);
  });
}
document.getElementById("spinWheelBtn")?.addEventListener("click", async () => {
  const btn=document.getElementById("spinWheelBtn"), msg=document.getElementById("wheelMessage");
  if (wheelIsAnimating || btn.disabled) return;
  wheelIsAnimating = true;
  btn.disabled = true;
  btn.textContent = "GOOD LUCK…";
  setMessage(msg,"Your Flamingo wheel is spinning…");
  try {
    const {data,error}=await supabaseClient.functions.invoke("student-rewards",{body:{action:"spin"}});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||"Could not spin.");
    const prize = Number(data.points_awarded);
    document.getElementById("wheelGraphic").dataset.winningSector = String(data.wheel_sector ?? (prize > 0 ? 0 : 2));
    await animateRewardWheel(prize);
    playRewardSound(prize > 0);
    if (prize > 0) celebrateReward();
    setMessage(msg,prize > 0 ? "🎉 Congratulations! You won " + prize + " points. They have been added to your wallet." : "✨ No points this time. Your next visit brings another chance!");
    wheelPromptShown = false;
    document.getElementById("rewardsSection")?.classList.remove("wheel-ready");
    await loadRewards();
  } catch(e) {
    setMessage(msg,e.message||"Could not spin. Please try again.",true);
  } finally {
    wheelIsAnimating = false;
    btn.textContent = "SPIN THE WHEEL";
    await loadRewards();
  }
});

async function loadStudentData() {
  if (!currentUser) return;
  const [profileResult, cardResult, pointsResult] = await Promise.all([
    supabaseClient.from("student_profiles").select("full_name, phone, university, study_level").eq("user_id", currentUser.id).maybeSingle(),
    supabaseClient.from("student_cards").select("member_id, qr_token, status").eq("user_id", currentUser.id).maybeSingle(),
    supabaseClient.from("loyalty_points").select("points").eq("user_id", currentUser.id)
  ]);

  if (profileResult.error) throw profileResult.error;
  if (cardResult.error) throw cardResult.error;
  if (pointsResult.error) throw pointsResult.error;

  const profile = profileResult.data || {};
  const card = cardResult.data;
  document.getElementById("profileName").value = profile.full_name || currentUser.user_metadata?.full_name || "";
  document.getElementById("profilePhone").value = profile.phone || "";
  document.getElementById("profileUniversity").value = profile.university || "";
  document.getElementById("profileLevel").value = profile.study_level || "";
  document.getElementById("cardName").textContent = (profile.full_name || currentUser.email || "STUDENT MEMBER").toUpperCase();
  document.getElementById("cardUniversity").textContent = (profile.university || "YOUR UNIVERSITY").toUpperCase();
  const profileComplete = Boolean(profile.phone && profile.university?.trim() && profile.study_level?.trim() && (profile.phone.replace(/\\D/g, "").length >= 8) && (profile.phone.replace(/\\D/g, "").length <= 15));
  document.getElementById("profileStatus").textContent = card?.status === "active" ? "CARD ACTIVE" : (profileComplete ? "ACTIVATING…" : "COMPLETE PROFILE");
  document.getElementById("cardStatus").textContent = (card?.status || "PENDING").toUpperCase();
  document.getElementById("memberNumber").textContent = card?.member_id || "CARD PENDING";
  const totalPoints = (pointsResult.data || []).reduce((sum, row) => sum + Number(row.points || 0), 0);
  document.getElementById("pointsTotal").textContent = String(totalPoints);

  const qr = document.getElementById("studentQr");
  qr.replaceChildren();
  if (card?.qr_token && window.QRCode) {
    new QRCode(qr, { text: card.qr_token, width: 150, height: 150, colorDark: "#35151f", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    document.getElementById("qrCaption").textContent = "Unique student QR · " + (card.member_id || "");
  } else {
    document.getElementById("qrCaption").textContent = "Your digital card is being prepared. Please contact the Flamingo team.";
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const saveButton = document.getElementById("saveProfileBtn");
  saveButton.disabled = true;
  setMessage(document.getElementById("profileMessage"), "Saving your details…");
  try {
    const updates = {
      full_name: document.getElementById("profileName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      university: document.getElementById("profileUniversity").value.trim(),
      study_level: document.getElementById("profileLevel").value.trim(),
      updated_at: new Date().toISOString()
    };
    const phoneDigits = updates.phone.replace(/\\D/g, "");
    if (!updates.full_name || !updates.phone || !updates.university || !updates.study_level) {
      throw new Error("Please complete your name, phone number, faculty and study level.");
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      throw new Error("Enter a valid phone number (8 to 15 digits).");
    }
    const { error } = await supabaseClient.from("student_profiles").update(updates).eq("user_id", currentUser.id);
    if (error) throw error;
    document.getElementById("userName").textContent = updates.full_name;
    await loadStudentData();
    const { data: refreshedCard, error: cardError } = await supabaseClient.from("student_cards").select("status").eq("user_id", currentUser.id).maybeSingle();
    if (cardError) throw cardError;
    appView.classList.remove("profile-setup-mode");
    setMessage(document.getElementById("profileMessage"), refreshedCard?.status === "active" ? "Profile saved — your student card is now ACTIVE!" : "Profile saved. Your card is still pending activation.");
  } catch (error) {
    setMessage(document.getElementById("profileMessage"), error.message || "Could not save profile.", true);
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  authForm.reset();
  setMode(false);
});

(async function init() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) setMessage(authMessage, error.message, true);
  if (session?.user) {
    try { await showApp(session.user); }
    catch (loadError) { setMessage(authMessage, loadError.message || "Could not load your student data.", true); }
  }
})();


// FLAMINGO PAGE NAVIGATION — sidebar tabs, no long-page scrolling.
(() => {
  const nav = document.getElementById("studentNav");
  const app = document.getElementById("appView");
  if (!nav || !app) return;
  const pages = ["home","card","offers","rewards","events","scan"];
  const targets = {
    home: "homeSection", card: "studentCardSection",
    offers: "offersSection", rewards: "rewardsSection",
    events: "eventsSection", scan: "scannerSection"
  };
  function showPage(page) {
    if (!targets[page]) return;
    app.dataset.page = page;
    nav.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active",
      (el.id === "navScan" ? "scan" : (el.getAttribute("href") || "").replace("#","").replace("Section","").replace("studentCard","card")) === page
    ));
    if (page === "scan") document.getElementById("scannerSection")?.classList.remove("hidden");
    else document.getElementById("scannerSection")?.classList.add("hidden");
  }
  document.querySelectorAll(".home-shortcut, .mobile-promo").forEach(item => {
    item.addEventListener("click", event => {
      const page = item.dataset.page;
      if (!page || !targets[page]) return;
      event.preventDefault();
      showPage(page);
      nav.querySelectorAll(".nav-item").forEach(el => {
        const target = el.id === "navScan" ? "scan" : ({
          "#homeSection":"home","#studentCardSection":"card","#offersSection":"offers",
          "#rewardsSection":"rewards","#eventsSection":"events"
        }[el.getAttribute("href")]);
        el.classList.toggle("active", target === page);
      });
    });
  });
  nav.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", event => {
      const page = item.id === "navScan" ? "scan" : ({
        "#homeSection":"home","#studentCardSection":"card","#offersSection":"offers",
        "#rewardsSection":"rewards","#eventsSection":"events"
      }[item.getAttribute("href")]);
      if (!page) return;
      event.preventDefault();
      showPage(page);
    });
  });
  showPage("home");
})();
