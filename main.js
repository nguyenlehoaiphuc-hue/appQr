// =============================
// CONFIG
// =============================
const BASE_URL = "https://appqr-sn45.onrender.com";   // ← Đổi nếu domain Render thay đổi
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
  setTimeout(() => toast.remove(), 5000);
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
      setTimeout(() => el.classList.remove('bg-blue-50'), 2500);
    }
  });
}

// =============================
// EXTRACT GPKD - TỐI ƯU CHO ĐIỆN THOẠI
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extractBtn");
  const fileInput = document.getElementById("gpkd");

  if (!extractBtn || !fileInput) {
    console.warn("Không tìm thấy nút extractBtn hoặc input gpkd");
    return;
  }

  extractBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      showNotification("Vui lòng chọn ảnh Giấy phép kinh doanh!", "error");
      return;
    }

    // Giới hạn kích thước file
    if (file.size > 8 * 1024 * 1024) {
      showNotification("Ảnh quá lớn (>8MB). Vui lòng chụp lại hoặc nén ảnh!", "error");
      return;
    }

    extractBtn.innerHTML = "⏳ Đang xử lý ảnh... (10-30 giây)";
    extractBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 70000); // 70 giây

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        fillData(result.data);
        showNotification("✅ Trích xuất thông tin thành công!", "success");
      } else {
        throw new Error(result.error || "Không thể trích xuất dữ liệu");
      }

    } catch (error) {
      console.error("Extract GPKD error:", error);

      if (error.name === "AbortError") {
        showNotification("⏰ Thời gian xử lý quá lâu. Vui lòng thử lại!", "error");
      } else if (error.message.includes("Failed to fetch") || error.message.includes("ERR_HTTP2")) {
        showNotification("❌ Không kết nối được với server. Kiểm tra mạng di động!", "error");
      } else {
        showNotification("❌ Lỗi: " + error.message, "error");
      }
    } finally {
      extractBtn.innerHTML = "Trích xuất thông tin GPKD";
      extractBtn.disabled = false;
    }
  });
});

// =============================
// SUBMIT FORM
// =============================
async function submitProfile() {
  const submitBtn = document.getElementById("submitBtn");
  if (!submitBtn) return;

  const payload = {
    business_name: document.getElementById('business_name')?.value || "",
    business_code: document.getElementById('business_code')?.value || "",
    issued_date: document.getElementById('issued_date')?.value || "",
    issued_place: document.getElementById('issued_place')?.value || "",
    business_address: document.getElementById('business_address')?.value || "",
    phone: document.getElementById('phone')?.value || "",
    email: document.getElementById('email')?.value || "",
    capital: document.getElementById('capital')?.value || ""
  };

  if (!payload.business_name || !payload.email) {
    showNotification("Vui lòng nhập tên doanh nghiệp và email!", "error");
    return;
  }

  submitBtn.innerHTML = "⏳ Đang gửi hồ sơ...";
  submitBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));

    // Append files
    const fileInputs = ["gpkd", "cccd_front", "cccd_back", "sim_image"];
    fileInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input && input.files.length > 0) {
        formData.append("files", input.files[0]);
      }
    });

    const response = await fetch(SUBMIT_URL, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      showNotification("✅ Gửi hồ sơ thành công!", "success");
    } else {
      showNotification("❌ " + (result.message || "Gửi thất bại"), "error");
    }

  } catch (err) {
    console.error(err);
    showNotification("❌ Không kết nối được với server. Kiểm tra mạng!", "error");
  } finally {
    submitBtn.innerHTML = "Gửi hồ sơ";
    submitBtn.disabled = false;
  }
}

// Bind submit button
document.getElementById("submitBtn")?.addEventListener("click", submitProfile);