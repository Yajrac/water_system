// Explicit placeholders only; working and validation-disabled buttons keep their behavior.
document.querySelectorAll('[data-unavailable]').forEach((button) => {
  button.addEventListener('click', () => {
    showNotice(
      button.dataset.unavailable + ' ? hindi pa available',
      button.dataset.unavailableMessage ||
        'Inaayos pa ang feature na ito. Wala pang pagbabago sa records.',
    );
  });
});
