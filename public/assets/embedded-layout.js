// Wix supplies the outer site header. Keep page titles and controls in the embed.
// Comparing WindowProxy identities is safe even with a cross-origin parent.
if (window.self !== window.top) document.documentElement.classList.add('cobra-embedded');
