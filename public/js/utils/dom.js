/**
 * DOM utilities - Helper functions for DOM manipulation and formatting
 */

export function escapeHtml(text) {
  if (!text && text !== 0) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

export function show(el) {
  if (el) el.classList.remove('hidden');
}

export function hide(el) {
  if (el) el.classList.add('hidden');
}

export function toggle(el, condition) {
  if (condition) {
    el?.classList.remove('hidden');
  } else {
    el?.classList.add('hidden');
  }
}

export function showById(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function hideById(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}