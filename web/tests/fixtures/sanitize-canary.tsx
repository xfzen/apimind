import { sanitizeHTML } from '../../common/sanitize';

const container = document.getElementById('canary');

if (!container) {
  throw new Error('Missing #canary container');
}

container.dataset.testid = 'sanitize-output';
container.innerHTML = sanitizeHTML(
  '<p>safe content</p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onerror="window.__sanitizeCanaryExecuted = true"><script>window.__sanitizeCanaryExecuted = true</script>'
);
