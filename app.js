// Flamingo Student App — authentication foundation
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
let isSignUp = false;

document.getElementById("year").textContent = new Date().getFullYear();

function setMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#a33b35" : "#8c5246";
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
  setMessage("");
}

switchMode.addEventListener("click", () => setMode(!isSignUp));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  submitBtn.disabled = true;
  setMessage(isSignUp ? "Creating your account…" : "Signing you in…");
  try {
    if (isSignUp) {
      const { data, error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { full_name: fullName.value.trim() } }
      });
      if (error) throw error;
      if (data.session) await showApp(data.user);
      else setMessage("Account created. Check your email to confirm your account, then sign in.");
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await showApp(data.user);
    }
  } catch (error) {
    setMessage(error.message || "Something went wrong. Please try again.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

async function showApp(user) {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
  document.getElementById("userName").textContent = displayName;
  document.getElementById("cardEmail").textContent = (user.email || "MEMBER").toUpperCase();
}

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  authForm.reset();
  setMode(false);
});

(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) await showApp(session.user);
})();