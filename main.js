// Hàm nén ảnh để cứu RAM cho Render
async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200; // Giảm độ phân giải xuống mức đủ đọc chữ
        let scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.7); // Nén chất lượng xuống 70%
      };
    };
  });
}
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
// PREVIEW ẢNH GPKD
// =============================
document.getElementById("gpkd").addEventListener("change", function(e) {
  const file = e.target.files[0];
  const previewContainer = document.getElementById("previewContainer");
  const previewImg = document.getElementById("gpkdPreview");

  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      previewImg.src = event.target.result;
      previewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    previewContainer.classList.add("hidden");
  }
});
// =============================
// EXTRACT GPKD - FIX ERR_HTTP2_PROTOCOL_ERROR
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extractBtn");
  const fileInput = document.getElementById("gpkd");

  if (!extractBtn || !fileInput) return;

  extractBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const originalFile = fileInput.files[0];
    if (!originalFile) {
        showNotification("Vui lòng chọn ảnh!", "error");
        return;
    }

    extractBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang nén & gửi...`;
    extractBtn.disabled = true;

    try {
        // NÉN ẢNH TRƯỚC KHI GỬI
        const compressedFile = await compressImage(originalFile);
        
        const formData = new FormData();
        formData.append("file", compressedFile); // Gửi file đã nén

        const response = await fetch(API_URL, {
            method: "POST",
            body: formData,
            mode: "cors",
        });

        const result = await response.json();
        // ... giữ nguyên phần xử lý kết quả bên dưới

      if (result.success) {
        fillData(result.data);
        showNotification("✅ Trích xuất thông tin thành công!", "success");
      } else {
        throw new Error(result.error || "Trích xuất thất bại");
      }

    } catch (error) {
      console.error("Extract GPKD error:", error);

      if (error.message.includes("HTTP2") || error.message.includes("Failed to fetch")) {
        showNotification("❌ Lỗi kết nối server. Vui lòng thử lại hoặc dùng WiFi mạnh hơn!", "error");
      } else {
        showNotification("❌ Lỗi: " + (error.message || "Không xác định"), "error");
      }
    } finally {
      extractBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Trích xuất thông tin từ GPKD`;
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