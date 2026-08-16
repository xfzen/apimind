import React, { useState } from 'react';

import Loading from '../../client/components/Loading/Loading';
import MyPopConfirm from '../../client/components/MyPopConfirm/MyPopConfirm';
import { renderInto } from '../../client/shims/reactRoot';

declare global {
  interface Window {
    __phase3ConfirmResult?: boolean;
  }
}

function SharedUiCanary() {
  const [visible, setVisible] = useState(false);
  const [confirmKey, setConfirmKey] = useState(0);
  return (
    <>
      <div style={{ position: 'relative', zIndex: 10001 }}>
        <button
          data-testid="toggle-loading"
          onClick={() => setVisible(value => !value)}
        >
          toggle loading
        </button>
        <button
          data-testid="reopen-confirm"
          onClick={() => setConfirmKey(value => value + 1)}
        >
          reopen confirm
        </button>
      </div>
      <Loading visible={visible} />
      <MyPopConfirm
        key={confirmKey}
        msg="leave editor"
        callback={result => {
          window.__phase3ConfirmResult = result;
        }}
      />
    </>
  );
}

const container = document.getElementById('canary');
if (!container) {
  throw new Error('Missing #canary container');
}
renderInto(container, <SharedUiCanary />);
