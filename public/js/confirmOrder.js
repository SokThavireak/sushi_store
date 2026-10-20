/* public/js/confirmOrder.js – SweetAlert2 confirm dialogs + toast helper */

// ---------- Toast ----------
function uiToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const isError = type === "error";
  const bg = isError ? "bg-red-500" : "bg-green-500";
  const icon = isError ? '<i class="fa-solid fa-circle-exclamation"></i>'
                       : '<i class="fa-solid fa-circle-check"></i>';
  const toast = document.createElement("div");
  toast.className = `${bg} text-white flex items-center gap-3 px-6 py-4 rounded-lg shadow-md mt-2 opacity-0`;
  toast.innerHTML = `${icon}<span class="font-bold text-sm">${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove("opacity-0"));
  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ---------- Generic confirm (green style) ----------
function confirmAction(event, message) {
  event.preventDefault();
  Swal.fire({
    title: message,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes",
    cancelButtonText: "No",
    background: "#1f2937",
    color: "#f9fafb",
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#ef4444"
  }).then((result) => {
    if (result.isConfirmed) {
      event.target.submit();
      uiToast("Action confirmed", "success");
    } else {
      uiToast("Action cancelled", "error");
    }
  });
  return false;
}

// ---------- Cancel‑order confirm (red style) ----------
async function doubleCancelConfirm(e) {
    e.preventDefault();
    const result = await Swal.fire({
        title: 'Cancel Order?',
        text: 'This action will cancel the order. Are you sure?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, cancel order',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        e.target.submit();
    }
    return false;
}

// New update confirmation (doubleUpdateConfirm)
async function doubleUpdateConfirm(e) {
    e.preventDefault();
    const result = await Swal.fire({
        title: 'Update Order?',
        text: 'Save changes to this order?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981', // emerald green
        cancelButtonColor: '#6b7280', // gray
        confirmButtonText: 'Yes, update order',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        e.target.submit();
    }
    return false;
}

// New delete entire order confirmation (doubleDeleteEntireConfirm)
async function doubleDeleteEntireConfirm(e) {
    e.preventDefault();
    const result = await Swal.fire({
        title: 'Delete Order?',
        text: 'This action will permanently delete the order. Are you sure?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // red
        cancelButtonColor: '#6b7280', // gray
        confirmButtonText: 'Yes, delete order',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        e.target.submit();
    }
    return false;
}
// New delete confirmation using SweetAlert2
async function doubleDeleteConfirm(event) {
    event.preventDefault();
    const result = await Swal.fire({
        title: 'Delete Order?',
        text: 'This action will permanently delete the order. Are you sure?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', // red
        cancelButtonColor: '#6b7280', // gray
        confirmButtonText: 'Yes, delete order',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        event.target.submit();
    }
    return false;
}

// New edit confirmation using SweetAlert2
async function doubleEditConfirm(event) {
    event.preventDefault();
    const result = await Swal.fire({
        title: 'Edit Order?',
        text: 'You will be taken to the edit page. Continue?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981', // emerald green
        cancelButtonColor: '#6b7280', // gray
        confirmButtonText: 'Proceed',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        // Follow the link
        window.location.href = event.currentTarget.getAttribute('href');
    }
    return false;
}

// New update confirmation using SweetAlert2 (for the Update Order Details form)
async function doubleUpdateConfirm(event) {
    event.preventDefault();
    const result = await Swal.fire({
        title: 'Update Order?',
        text: 'Save changes to this order?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981', // emerald green
        cancelButtonColor: '#6b7280', // gray
        confirmButtonText: 'Save',
        background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        customClass: { popup: 'rounded-2xl shadow-xl font-sans' }
    });
    if (result.isConfirmed) {
        // Submit the form
        event.target.submit();
    }
    return false;
}

function cancelOrderConfirm(event) {
    event.preventDefault();
    Swal.fire({
        title: "Cancel this Order?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Cancel Order",
        cancelButtonText: "Keep",
        background: "#1f2937",
        color: "#f9fafb",
        confirmButtonColor: "#ef4444", // red
        cancelButtonColor: "#10b981"
    }).then((result) => {
        if (result.isConfirmed) {
            event.target.submit();
            uiToast("Order cancelled", "success");
        } else {
            uiToast("Cancellation aborted", "error");
        }
    });
    return false;
}

// expose globally
window.doubleConfirm = function(event, message) {
  // Simple fallback using native confirm; can be upgraded to SweetAlert2 if needed
  return confirm(message);
};
window.uiToast = uiToast;
window.confirmAction = confirmAction;
window.cancelOrderConfirm = cancelOrderConfirm;
window.doubleCancelConfirm = doubleCancelConfirm;
window.doubleDeleteConfirm = doubleDeleteConfirm;
window.doubleEditConfirm = doubleEditConfirm;
window.doubleUpdateConfirm = doubleUpdateConfirm;
window.doubleDeleteEntireConfirm = doubleDeleteEntireConfirm;
