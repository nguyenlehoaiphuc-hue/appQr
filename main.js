// =============================
// CONFIG
// =============================
const BASE_URL = "https://appqr-sn45.onrender.com";
const API_URL = `${BASE_URL}/extract-gpkd`;
const SUBMIT_URL = `${BASE_URL}/submit-form`;

// =============================
// NOTIFICATION
// =============================
function showNotification(message, type = "success") {
  const color = type === "error" ? "bg-red-600" : "bg-green-600";
  const toast = document.createElement("div");
  toast.className = `fixed top-5 right-5 ${color} text-white px-6 py-4 rounded-xl shadow-2xl z-[100]`;
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// =============================
// FILL DATA
// =============================
function fillData(data) {
  Object.keys(data).forEach(key => {
    const el = document.getElementById(key);
    if (el) {
      el.value = data[key] || "";
      el.classList.add('bg-blue-50');
      setTimeout(() => el.classList.remove('bg-blue-50'), 2000);
    }
  });
}

// =============================
// EXTRACT GPKD (AI)
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extractBtn");
  const fileInput = document.getElementById("gpkd");

  if (!extractBtn) return;

  extractBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      showNotification("Chọn ảnh GPKD trước!", "error");
      return;
    }

    extractBtn.innerHTML = "⏳ Đang xử lý...";
    extractBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: formData
      });

      const result = await res.json();

      if (result.success) {
        fillData(result.data);
        showNotification("Trích xuất thành công!");
      } else {
        throw new Error(result.error);
      }

    } catch (err) {
      console.error(err);
      showNotification("Lỗi AI hoặc server!", "error");
    } finally {
      extractBtn.innerHTML = "Trích xuất";
      extractBtn.disabled = false;
    }
  });
});

// =============================
// SUBMIT FORM
// =============================
async function submitProfile() {
  const submitBtn = document.getElementById("submitBtn");

  // Thu thập dữ liệu
  const payload = {
    business_name: document.getElementById('business_name').value,
    business_code: document.getElementById('business_code').value,
    issued_date: document.getElementById('issued_date').value,
    issued_place: document.getElementById('issued_place').value,
    business_address: document.getElementById('business_address').value,
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value,
    capital: document.getElementById('capital').value
  };

  if (!payload.business_name || !payload.email) {
    showNotification("Thiếu thông tin!", "error");
    return;
  }

  submitBtn.innerHTML = "⏳ Đang gửi...";
  submitBtn.disabled = true;

  try {
    // 🔥 FIX QUAN TRỌNG: dùng FormData
    const formData = new FormData();

    // payload
    formData.append("payload", JSON.stringify(payload));

    // 🔥 lấy từng input riêng
    const gpkd = document.getElementById("gpkd");
    const cccd_truoc = document.getElementById("cccd_front");
    const cccd_sau = document.getElementById("cccd_back");
    const sim = document.getElementById("sim_image");

    // 🔥 append từng cái nếu có
    if (gpkd && gpkd.files.length > 0) {
    formData.append("files", gpkd.files[0]);
    }

    if (cccd_truoc && cccd_truoc.files.length > 0) {
    formData.append("files", cccd_truoc.files[0]);
    }

    if (cccd_sau && cccd_sau.files.length > 0) {
    formData.append("files", cccd_sau.files[0]);
    }

    if (sim && sim.files.length > 0) {
    formData.append("files", sim.files[0]);
    }

    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      body: formData   // ❌ KHÔNG set Content-Type
    });

    const result = await res.json();

    if (result.success) {
      showNotification("✅ Gửi thành công!");
    } else {
      showNotification("❌ " + result.message, "error");
    }

  } catch (err) {
    console.error(err);
    showNotification("❌ Không kết nối server!", "error");
  } finally {
    submitBtn.innerHTML = "Gửi hồ sơ";
    submitBtn.disabled = false;
  }
}

// =============================
// BIND BUTTON
// =============================
document.getElementById("submitBtn")?.addEventListener("click", submitProfile);
