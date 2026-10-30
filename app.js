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

document.getElementById("year").textContent = new Date().getFullYear();

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#a33b35" : "#8c5246";
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
  await checkFlamingoAdmin();
}

async function checkFlamingoAdmin() {
  const adminPanel = document.getElementById("adminPanel");
  if (!currentUser || !adminPanel) return;
  adminPanel.classList.add("hidden");

  if ((currentUser.email || "").toLowerCase() === "azizmarouch14@gmail.com") {
    const { data, error } = await supabaseClient.rpc("claim_flamingo_admin");
    if (error) {
      console.error("Flamingo admin setup:", error.message);
      return;
    }
    if (data === true) {
      adminPanel.classList.remove("hidden");
      document.getElementById("adminEmail").textContent = currentUser.email;
    }
    return;
  }

  const { data, error } = await supabaseClient.rpc("is_flamingo_staff");
  if (!error && data === true) adminPanel.classList.remove("hidden");
  if (!error && data === true) document.getElementById("adminEmail").textContent = currentUser.email || "Staff account";
}

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
    heading.textContent = data.valid ? "VALID STUDENT CARD" : (data.status || "NOT VERIFIED").toUpperCase();
    const name = document.createElement("span");
    name.textContent = data.full_name || "Unknown student";
    const member = document.createElement("span");
    member.textContent = data.member_id ? "Member ID: " + data.member_id : "";
    const university = document.createElement("span");
    university.textContent = [data.university, data.study_level].filter(Boolean).join(" · ");
    const message = document.createElement("span");
    message.textContent = data.message || "Verification complete";
    resultBox.append(heading, name, member, university, message);
    resultBox.className = "scan-result " + (data.valid ? "scan-valid" : "scan-invalid");
  } catch (error) {
    resultBox.className = "scan-result scan-invalid";
    setMessage(resultBox, error.message || "Could not verify this QR code.", true);
  }
}

document.getElementById("startScannerBtn")?.addEventListener("click", startStudentScanner);
document.getElementById("stopScannerBtn")?.addEventListener("click", stopStudentScanner);

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
  document.getElementById("profileStatus").textContent = profile.university && profile.study_level ? "PROFILE READY" : "COMPLETE PROFILE";
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
      phone: document.getElementById("profilePhone").value.trim() || null,
      university: document.getElementById("profileUniversity").value.trim() || null,
      study_level: document.getElementById("profileLevel").value.trim() || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabaseClient.from("student_profiles").update(updates).eq("user_id", currentUser.id);
    if (error) throw error;
    document.getElementById("userName").textContent = updates.full_name || "Student";
    document.getElementById("cardName").textContent = (updates.full_name || "STUDENT MEMBER").toUpperCase();
    document.getElementById("cardUniversity").textContent = (updates.university || "YOUR UNIVERSITY").toUpperCase();
    setMessage(document.getElementById("profileMessage"), "Profile saved successfully.");
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
