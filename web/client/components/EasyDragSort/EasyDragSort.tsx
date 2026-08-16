import React from 'react';
import ReactDOM from 'react-dom';

import PropTypes from 'prop-types';
import type { MouseEvent, ReactElement, ReactNode } from 'react';

/**
 * @author suxiaoxin
 * @demo
 * <EasyDragSort data={()=>this.state.list} onChange={this.handleChange} >
 * {list}
 * </EasyDragSot>
 */
let curDragIndex: number | null = null;

function isDom(obj: unknown): obj is HTMLElement {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'nodeType' in obj &&
    obj.nodeType === 1 &&
    'nodeName' in obj &&
    typeof obj.nodeName === 'string' &&
    'getAttribute' in obj &&
    typeof obj.getAttribute === 'function'
  );
}

interface EasyDragSortProps {
  children: ReactNode[];
  onChange?: (data: unknown[], from: number | null, to: number) => unknown;
  onDragEnd?: () => void;
  data: () => unknown[];
  onlyChild?: string;
}

export default class EasyDragSort extends React.Component<EasyDragSortProps> {
  static propTypes = {
    children: PropTypes.array,
    onChange: PropTypes.func,
    onDragEnd: PropTypes.func,
    data: PropTypes.func,
    onlyChild: PropTypes.string
  };

  render() {
    const that = this;
    const props = this.props;
    const { onlyChild } = props;
    let container = props.children;
    const onChange = (from: number | null, to: number) => {
      if (from === to) {
        return;
      }
      let curValue;

      curValue = props.data();

      let newValue = arrMove(curValue, from, to);
      if (typeof props.onChange === 'function') {
        return props.onChange(newValue, from, to);
      }
    };
    return (
      <div>
        {container.map((item, index) => {
          if (React.isValidElement<Record<string, unknown>>(item)) {
            return React.cloneElement(item as ReactElement<Record<string, unknown>>, {
              draggable: onlyChild ? false : true,
              ref: 'x' + index,
              'data-ref': 'x' + index,
              onDragStart: function() {
                curDragIndex = index;
              },
              /**
               * 控制 dom 是否可拖动
               * @param {*} e
               */
              onMouseDown(e: MouseEvent) {
                if (!onlyChild) {
                  return;
                }
                let el: HTMLElement | null = isDom(e.target) ? e.target : null;
                let target: HTMLElement | null = el;
                if (!isDom(el)) {
                  return;
                }
                do {
                  if (el && isDom(el) && el.getAttribute(onlyChild)) {
                    target = el;
                  }
                  if (el && el.tagName == 'DIV' && el.getAttribute('data-ref')) {
                    break;
                  }
                } while ((el = el.parentElement));
                if (!el) {
                  return;
                }
                const refName = el.getAttribute('data-ref') || '';
                const ref = (that.refs as Record<string, React.ReactInstance>)[refName];
                const dom = ReactDOM.findDOMNode(ref);
                if (isDom(dom) && target) {
                  dom.draggable = target.getAttribute(onlyChild) ? true : false;
                }
              },
              onDragEnter: function() {
                onChange(curDragIndex, index);
                curDragIndex = index;
              },
              onDragEnd: function() {
                curDragIndex = null;
                if (typeof props.onDragEnd === 'function') {
                  props.onDragEnd();
                }
              }
            });
          }
          return item;
        })}
      </div>
    );
  }
}

function arrMove(arr: unknown[], fromIndex: number | null, toIndex: number): unknown[] {
  arr = ([] as unknown[]).concat(arr);
  const item = arr.splice(fromIndex as number, 1)[0];
  arr.splice(toIndex, 0, item);
  return arr;
}
