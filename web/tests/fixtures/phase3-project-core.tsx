import React, { useState } from 'react';

import TemplateEditor from '../../client/containers/Project/TemplateProject/TemplateEditor';
import type { TemplateEditorSaveValue } from '../../client/containers/Project/TemplateProject/TemplateEditor';
import { renderInto } from '../../client/shims/reactRoot';

declare global {
  interface Window {
    __phase3TemplateCancelled?: boolean;
    __phase3TemplateSaved?: TemplateEditorSaveValue;
  }
}

const template = {
  key: 'phase3-template',
  title: 'Before',
  description: 'Before description',
  markdown: '# Before'
};

function ProjectCoreCanary() {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button data-testid="unmount-template" onClick={() => setMounted(false)}>
        unmount
      </button>
      {mounted ? (
        <TemplateEditor
          template={template}
          onCancel={() => {
            window.__phase3TemplateCancelled = true;
          }}
          onSave={value => {
            window.__phase3TemplateSaved = value;
          }}
        />
      ) : null}
    </>
  );
}

const container = document.getElementById('canary');
if (!container) throw new Error('Missing #canary container');
renderInto(container, <ProjectCoreCanary />);
