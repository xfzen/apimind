import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Layout, Tree, Input, Button, Empty, Modal, message, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import { fetchDocs, fetchDoc, createDoc, updateDoc, moveDoc, deleteDoc } from '../../../../reducer/modules/docs';
import DocsWorkspace from '../../../../components/Docs/DocsWorkspace';
import { extractHeadings } from '../../../../components/Docs/markdownHeadings';
import { LAYOUT } from '../../../../constants/variable.js';
import '../../../../components/Docs/docs.scss';
import './docsInterface.scss';

const { Content, Sider } = Layout;

function yapiData(action) {
  return action && action.payload && action.payload.data
    ? action.payload.data
    : { errcode: 500, errmsg: '请求失败' };
}

function sortDocs(items) {
  return [].concat(items || []).sort((a, b) => {
    if ((a.parent_id || 0) === (b.parent_id || 0)) return (a.sort || 0) - (b.sort || 0);
    return (a.parent_id || 0) - (b.parent_id || 0);
  });
}

function isDocGroup(item) {
  return item && item.doc_type === 'group';
}

function isDocItem(item) {
  return item && item.doc_type !== 'group';
}

function markdownFileName(value) {
  const name = String(value || '').trim() || 'untitled';
  return /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
}

function docFileName(item, fallbackTitle) {
  if (item && item.slug) {
    return markdownFileName(item.slug);
  }
  return markdownFileName(fallbackTitle || (item && item.title));
}

@connect(
  state => ({
    projectMsg: state.project.currProject,
    docs: state.docs.list,
    current: state.docs.current
  }),
  { fetchDocs, fetchDoc, createDoc, updateDoc, moveDoc, deleteDoc }
)
export default class DocsInterface extends Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object,
    projectMsg: PropTypes.object,
    docs: PropTypes.array,
    current: PropTypes.object,
    fetchDocs: PropTypes.func,
    fetchDoc: PropTypes.func,
    createDoc: PropTypes.func,
    updateDoc: PropTypes.func,
    moveDoc: PropTypes.func,
    deleteDoc: PropTypes.func
  };

  state = {
    filter: '',
    mode: 'viewer',
    navMode: 'list',
    searchMode: false,
    activeTocId: '',
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    pendingDocId: null,
    confirmVisible: false,
    renameVisible: false,
    renameDoc: null,
    renameTitle: '',
    hoverDocId: null,
    docExpandedKeys: null
  };

  searchInputRef = React.createRef();

  workspaceRef = React.createRef();

  tocJumpTargetId = '';

  tocJumpTimer = null;

  componentDidMount() {
    document.body.classList.add('apimind-docs-fixed-scroll');
    this.bindBeforeUnload();
    this.loadDocs();
  }

  componentDidUpdate(prevProps) {
    const prevProject = prevProps.match.params.id;
    const nextProject = this.props.match.params.id;
    const prevDoc = this.docIdFromPath(prevProps.location && prevProps.location.pathname);
    const nextDoc = this.docIdFromPath(this.props.location && this.props.location.pathname);
    const prevProjectMsgId = Number((prevProps.projectMsg || {})._id || 0);
    const nextProjectMsgId = Number((this.props.projectMsg || {})._id || 0);

    if (this.isRestoringLocation) {
      this.isRestoringLocation = false;
      return;
    }

    if (prevProject !== nextProject) {
      this.loadDocs();
      return;
    }
    if (Number(nextProject) === nextProjectMsgId && prevProjectMsgId !== nextProjectMsgId) {
      this.loadDocs();
      return;
    }
    if (prevDoc !== nextDoc) {
      if (this.isDirty()) {
        this.setState({
          pendingDocId: nextDoc || 'root',
          confirmVisible: true
        });
        this.isRestoringLocation = true;
        this.props.history.replace(prevProps.location.pathname);
        return;
      }
      if (nextDoc && !isNaN(nextDoc)) {
        this.selectDoc(nextDoc);
      }
    }
  }

  componentWillUnmount() {
    document.body.classList.remove('apimind-docs-fixed-scroll');
    this.clearTocJumpLock();
    this.unbindBeforeUnload();
  }

  workspaceId() {
    return (this.props.projectMsg || {}).group_id;
  }

  projectId() {
    return Number(this.props.match.params.id);
  }

  docIdFromPath(pathname) {
    const match = String(pathname || '').match(/\/interface\/api\/([^/]+)/);
    return match ? match[1] : '';
  }

  canEdit() {
    const project = this.props.projectMsg || {};
    return ['admin', 'owner', 'dev'].indexOf(project.role) > -1;
  }

  isDirty() {
    return this.state.title !== this.state.originalTitle ||
      this.state.content !== this.state.originalContent;
  }

  bindBeforeUnload() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  unbindBeforeUnload() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = event => {
    if (!this.isDirty()) return undefined;
    event.preventDefault();
    event.returnValue = '';
    return '';
  };

  async loadDocs() {
    const workspaceId = this.workspaceId();
    const projectId = this.projectId();
    if (!workspaceId || !projectId || Number((this.props.projectMsg || {})._id) !== projectId) {
      return;
    }
    const res = yapiData(await this.props.fetchDocs(workspaceId, projectId));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    const actionId = this.docIdFromPath(this.props.location && this.props.location.pathname);
    if (actionId && !isNaN(actionId)) {
      await this.selectDoc(actionId);
      return;
    }
    const firstDoc = sortDocs(res.data || []).find(isDocItem);
    if (firstDoc) {
      await this.selectDoc(firstDoc.id);
      this.props.history.replace(`/project/${projectId}/interface/api/${firstDoc.id}`);
    }
  }

  selectDoc = async id => {
    const res = yapiData(await this.props.fetchDoc(id));
    if (res.errcode === 0) {
      if (isDocGroup(res.data)) {
        this.props.history.replace(`/project/${this.projectId()}/interface/api`);
        return;
      }
      const title = res.data.title || '';
      const content = res.data.content_md || '';
      this.setState({
        mode: 'viewer',
        activeTocId: '',
        title,
        content,
        originalTitle: title,
        originalContent: content,
        pendingDocId: null,
        confirmVisible: false
      });
    } else {
      message.error(res.errmsg);
    }
  };

  createNewDoc = async parentId => {
    if (!this.canEdit()) {
      return;
    }
    const res = yapiData(await this.props.createDoc({
      workspace_id: this.workspaceId(),
      project_id: this.projectId(),
      parent_id: parentId || 0,
      title: '新文档',
      content_md: '# 新文档\n'
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    await this.props.fetchDocs(this.workspaceId(), this.projectId());
    this.props.history.push(`/project/${this.projectId()}/interface/api/${res.data.id}`);
    this.setState({
      mode: 'editor',
      title: res.data.title,
      content: res.data.content_md || '',
      originalTitle: res.data.title,
      originalContent: res.data.content_md || ''
    });
  };

  createNewGroup = async () => {
    if (!this.canEdit()) {
      return;
    }
    const res = yapiData(await this.props.createDoc({
      workspace_id: this.workspaceId(),
      project_id: this.projectId(),
      parent_id: 0,
      title: '新分组',
      content_md: '',
      doc_type: 'group'
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    message.success('分组已创建');
    await this.refreshDocs();
    this.setState({
      docExpandedKeys: this.expandedKeysWith(`group_${res.data.id}`, true),
      renameVisible: true,
      renameDoc: res.data,
      renameTitle: res.data.title || '新分组'
    });
  };

  refreshDocs = async () => {
    return this.props.fetchDocs(this.workspaceId(), this.projectId());
  };

  renameDoc = item => {
    if (!this.canEdit()) {
      return;
    }
    this.setState({
      renameVisible: true,
      renameDoc: item,
      renameTitle: item.title
    });
  };

  submitRename = async () => {
    const item = this.state.renameDoc;
    const title = String(this.state.renameTitle || '').trim();
    if (!item || !title) {
      message.error(`${isDocGroup(item) ? '分类名称' : '文档标题'}不能为空`);
      return;
    }
    const detail = yapiData(await this.props.fetchDoc(item.id));
    if (detail.errcode !== 0) {
      message.error(detail.errmsg);
      return;
    }
    const res = yapiData(await this.props.updateDoc({
      id: item.id,
      title,
      content_md: detail.data.content_md || '',
      doc_type: detail.data.doc_type || 'markdown',
      tags: detail.data.tags || []
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    message.success(isDocGroup(item) ? '分类已修改' : '文档已重命名');
    await this.refreshDocs();
    this.setState({ renameVisible: false, renameDoc: null, renameTitle: '' });
    if (this.props.current && this.props.current.id === item.id) {
      await this.selectDoc(item.id);
    }
  };

  copyDoc = async item => {
    if (!this.canEdit()) {
      return;
    }
    const detail = yapiData(await this.props.fetchDoc(item.id));
    if (detail.errcode !== 0) {
      message.error(detail.errmsg);
      return;
    }
    const res = yapiData(await this.props.createDoc({
      workspace_id: this.workspaceId(),
      project_id: this.projectId(),
      parent_id: item.parent_id || 0,
      title: `${item.title}_copy`,
      content_md: detail.data.content_md || '',
      doc_type: detail.data.doc_type || 'markdown',
      tags: detail.data.tags || []
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    message.success(isDocGroup(item) ? '分组已复制' : '文档已复制');
    await this.refreshDocs();
    if (isDocItem(res.data)) {
      this.props.history.push(`/project/${this.projectId()}/interface/api/${res.data.id}`);
    }
  };

  deleteDocItem = async item => {
    const res = yapiData(await this.props.deleteDoc(item.id));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    message.success(isDocGroup(item) ? '分组已删除' : '文档已删除');
    const listRes = yapiData(await this.refreshDocs());
    const next = listRes.data && sortDocs(listRes.data).find(doc => doc.id !== item.id && isDocItem(doc));
    const navigate = () => {
      if (next) {
        this.props.history.push(`/project/${this.projectId()}/interface/api/${next.id}`);
      } else {
        this.props.history.push(`/project/${this.projectId()}/interface/api`);
      }
    };
    if (this.props.current && Number(this.props.current.id) === Number(item.id)) {
      this.setState({
        title: '',
        content: '',
        originalTitle: '',
        originalContent: ''
      }, navigate);
      return;
    }
    navigate();
  };

  showDeleteConfirm = item => {
    if (!this.canEdit()) {
      return;
    }
    const isCurrent = this.props.current && Number(this.props.current.id) === Number(item.id);
    const dirtyCurrent = isCurrent && this.isDirty();
    Modal.confirm({
      title: dirtyCurrent ? '当前文档有未保存修改，仍要删除吗？' : `您确认删除此${isDocGroup(item) ? '分组' : '文档'}吗？`,
      content: dirtyCurrent ? '删除当前文档会丢失未保存修改。' : `${isDocGroup(item) ? '分组' : '文档'}删除后不会在列表中显示。`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => this.deleteDocItem(item)
    });
  };

  saveDoc = async () => {
    const current = this.props.current;
    const title = String(this.state.title || '').trim();
    if (!current || !this.canEdit()) {
      return false;
    }
    if (!title) {
      message.error('文档标题不能为空');
      return false;
    }
    const res = yapiData(await this.props.updateDoc({
      id: current.id,
      title,
      content_md: this.state.content,
      doc_type: current.doc_type || 'markdown',
      tags: current.tags || []
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return false;
    }
    message.success('保存成功');
    await this.props.fetchDocs(this.workspaceId(), this.projectId());
    this.setState({
      title,
      originalTitle: title,
      originalContent: this.state.content
    });
    return true;
  };

  onSelect = selectedKeys => {
    const key = selectedKeys[0];
    const docId = this.docIdFromTreeKey(key);
    if (!key || key === 'root' || key === 'public' || String(key).indexOf('group_') === 0) {
      if (key === 'public' || String(key).indexOf('group_') === 0) {
        this.toggleDocExpanded(key);
      }
      return;
    }
    if (this.isDirty()) {
      this.setState({ pendingDocId: docId, confirmVisible: true });
      return;
    }
    this.props.history.push(`/project/${this.projectId()}/interface/api/${docId}`);
  };

  continueToPendingDoc = () => {
    const target = this.state.pendingDocId;
    this.setState({
      confirmVisible: false,
      pendingDocId: null,
      title: this.state.originalTitle,
      content: this.state.originalContent
    }, () => {
      if (!target || target === 'root') {
        this.props.history.push(`/project/${this.projectId()}/interface/api`);
        return;
      }
      this.props.history.push(`/project/${this.projectId()}/interface/api/${target}`);
    });
  };

  saveAndContinue = async () => {
    const ok = await this.saveDoc();
    if (ok) this.continueToPendingDoc();
  };

  currentDocExpandedKeys() {
    return this.state.docExpandedKeys || this.defaultTreeExpandedKeys();
  }

  expandedKeysWith(key, shouldExpand) {
    const keys = this.currentDocExpandedKeys();
    if (shouldExpand) {
      return keys.indexOf(key) > -1 ? keys : keys.concat(key);
    }
    return keys.filter(item => item !== key);
  }

  toggleDocExpanded = key => {
    const keys = this.currentDocExpandedKeys();
    this.setState({
      docExpandedKeys: keys.indexOf(key) > -1
        ? keys.filter(item => item !== key)
        : keys.concat(key)
    });
  };

  onDocExpand = expandedKeys => {
    this.setState({ docExpandedKeys: expandedKeys });
  };

  docIdFromTreeKey(key) {
    const value = String(key || '');
    if (value.indexOf('doc_') === 0) {
      return value.slice(4);
    }
    if (!isNaN(value)) {
      return value;
    }
    return '';
  }

  itemFromTreeKey(key) {
    const value = String(key || '');
    if (value.indexOf('group_') === 0) {
      const id = Number(value.slice(6));
      return (this.props.docs || []).find(doc => doc.id === id && isDocGroup(doc));
    }
    if (value.indexOf('doc_') === 0) {
      const id = Number(value.slice(4));
      return (this.props.docs || []).find(doc => doc.id === id);
    }
    if (!isNaN(value)) {
      const id = Number(value);
      return (this.props.docs || []).find(doc => doc.id === id);
    }
    return null;
  }

  onDrop = async info => {
    if (!this.canEdit()) {
      return;
    }
    const dragKey = info.dragNode.key || info.dragNode.props.eventKey;
    const dropKey = info.node.key || info.node.props.eventKey;
    const dragID = Number(this.docIdFromTreeKey(dragKey) || String(dragKey).replace('group_', ''));
    const dropIDRaw = info.node.key || info.node.props.eventKey;
    const dropID = this.docIdFromTreeKey(dropIDRaw) ? Number(this.docIdFromTreeKey(dropIDRaw)) : Number(String(dropIDRaw).replace('group_', ''));
    const dragItem = (this.props.docs || []).find(item => item.id === dragID);
    if (!dragItem) {
      return;
    }
    const dropItem = this.itemFromTreeKey(dropKey);
    let parentID = 0;
    if (isDocGroup(dragItem)) {
      parentID = 0;
    } else if (dropKey === 'public' || dropKey === 'root') {
      parentID = 0;
    } else if (!info.dropToGap && isDocGroup(dropItem)) {
      parentID = dropItem.id;
    } else {
      parentID = this.parentIdForDoc(dropID);
    }
    const siblings = (this.props.docs || []).filter(item => (item.parent_id || 0) === (parentID || 0));
    const sort = Math.max(0, siblings.findIndex(item => item.id === dropID));
    const res = yapiData(await this.props.moveDoc({
      id: dragID,
      parent_id: parentID || 0,
      sort: sort < 0 ? siblings.length : sort
    }));
    if (res.errcode !== 0) {
      message.error(res.errmsg);
      return;
    }
    await this.refreshDocs();
  };

  parentIdForDoc(id) {
    if (!id) {
      return 0;
    }
    const item = (this.props.docs || []).find(doc => doc.id === id);
    return item ? item.parent_id || 0 : 0;
  }

  enterItem = id => {
    this.setState({ hoverDocId: id });
  };

  leaveItem = () => {
    this.setState({ hoverDocId: null });
  };

  toggleNavMode = () => {
    this.setState({
      navMode: this.state.navMode === 'toc' ? 'list' : 'toc',
      searchMode: false
    });
  };

  enterSearchMode = () => {
    this.setState({ searchMode: true }, () => {
      if (this.searchInputRef.current && this.searchInputRef.current.focus) {
        this.searchInputRef.current.focus();
      }
    });
  };

  exitSearchMode = () => {
    this.setState({
      searchMode: false,
      filter: ''
    });
  };

  docHeadings() {
    return extractHeadings(this.state.content || '').filter(item => item.level <= 3);
  }

  filteredDocHeadings() {
    return this.docHeadings();
  }

  defaultTreeExpandedKeys() {
    const keys = ['root', 'public'];
    (this.props.docs || []).forEach(item => {
      if (isDocGroup(item) && (item.parent_id || 0) === 0) {
        keys.push(`group_${item.id}`);
      }
    });
    return keys;
  }

  clearTocJumpLock = () => {
    if (this.tocJumpTimer) {
      clearTimeout(this.tocJumpTimer);
      this.tocJumpTimer = null;
    }
    this.tocJumpTargetId = '';
  };

  startTocJumpLock = targetId => {
    this.clearTocJumpLock();
    this.tocJumpTargetId = targetId;
    this.tocJumpTimer = setTimeout(this.clearTocJumpLock, 1500);
  };

  setActiveTocId = (activeTocId, options = {}) => {
    if (this.tocJumpTargetId && !options.fromJump) {
      if (activeTocId !== this.tocJumpTargetId) {
        return;
      }
      this.clearTocJumpLock();
    }

    if (this.state.activeTocId === activeTocId) {
      return;
    }
    this.setState({ activeTocId }, () => {
      const activeItem = document.querySelector('.doc-side-toc-item.active');
      if (activeItem && activeItem.scrollIntoView) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  jumpToDocHeading = heading => {
    this.startTocJumpLock(heading.id);
    this.setActiveTocId(heading.id, { fromJump: true });
    if (this.workspaceRef.current && this.workspaceRef.current.jumpToHeading) {
      this.workspaceRef.current.jumpToHeading(heading);
      return;
    }
    const target = document.getElementById(heading.id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  buildTreeData() {
    const keyword = String(this.state.filter || '').trim();
    const allItems = sortDocs(this.props.docs || []);
    const groups = allItems.filter(item => isDocGroup(item) && (item.parent_id || 0) === 0);
    const groupIds = groups.reduce((map, item) => {
      map[item.id] = true;
      return map;
    }, {});
    const visibleDocs = allItems
      .filter(isDocItem)
      .filter(item => !keyword || item.title.indexOf(keyword) > -1);
    const docsForParent = parentId => visibleDocs.filter(item => {
      const itemParent = item.parent_id || 0;
      if (!parentId) {
        return itemParent === 0 || !groupIds[itemParent];
      }
      return itemParent === parentId;
    });
    const makeDocNodes = parentId => docsForParent(parentId).map(item => ({
      key: `doc_${item.id}`,
      title: (
        <div
          className="container-title doc-project-title"
          onMouseEnter={() => this.enterItem(item.id)}
          onMouseLeave={this.leaveItem}
        >
          <span className="interface-item">
            <Icon type="file-text" />
            <span className="doc-tree-title-text">{item.title}</span>
          </span>
          {this.canEdit() ? (
            <span className="btns">
              <Tooltip title="重命名文档">
                <Icon
                  type="edit"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.renameDoc(item);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
              <Tooltip title="复制文档">
                <Icon
                  type="copy"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.copyDoc(item);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
              <Tooltip title="删除文档">
                <Icon
                  type="delete"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.showDeleteConfirm(item);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
            </span>
          ) : null}
        </div>
      )
    }));

    const makeGroupNode = item => ({
      key: `group_${item.id}`,
      title: (
        <div
          className="container-title doc-project-title doc-project-group-title"
          onMouseEnter={() => this.enterItem(item.id)}
          onMouseLeave={this.leaveItem}
        >
          <span className="interface-item">
            <Icon type="folder-open" />
            <span
              className="doc-tree-title-text"
              onClick={e => {
                e.stopPropagation();
                this.toggleDocExpanded(`group_${item.id}`);
              }}
            >
              {item.title}
            </span>
          </span>
          {this.canEdit() ? (
            <span className="btns">
              <Tooltip title="删除分类">
                <Icon
                  type="delete"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.showDeleteConfirm(item);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
              <Tooltip title="修改分类">
                <Icon
                  type="edit"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.renameDoc(item);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
              <Tooltip title="新建文档">
                <Icon
                  type="plus"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.createNewDoc(item.id);
                  }}
                  style={{ display: this.state.hoverDocId === item.id ? 'block' : 'none' }}
                />
              </Tooltip>
            </span>
          ) : null}
        </div>
      ),
      children: makeDocNodes(item.id)
    });

    return [
      {
        className: 'item-all-interface',
        title: (
          <span>
            <Icon type="folder" style={{ marginRight: 5 }} />
            全部文档
          </span>
        ),
        key: 'root'
      },
      {
        className: 'interface-item-nav',
        title: (
          <div
            className="container-title doc-project-title doc-project-public-title"
            onMouseEnter={() => this.enterItem('public')}
            onMouseLeave={this.leaveItem}
          >
            <span className="interface-item">
              <Icon type="folder-open" />
              <span
                className="doc-tree-title-text"
                onClick={e => {
                  e.stopPropagation();
                  this.toggleDocExpanded('public');
                }}
              >
                公共文档
              </span>
            </span>
            {this.canEdit() ? (
              <span className="btns">
                <Tooltip title="新建文档">
                  <Icon
                    type="plus"
                    className="interface-delete-icon"
                    onClick={e => {
                      e.stopPropagation();
                      this.createNewDoc(0);
                    }}
                    style={{ display: this.state.hoverDocId === 'public' ? 'block' : 'none' }}
                  />
                </Tooltip>
              </span>
            ) : null}
          </div>
        ),
        key: 'public',
        children: makeDocNodes(0)
      },
      ...groups
        .filter(item => !keyword || docsForParent(item.id).length > 0)
        .map(makeGroupNode)
    ];
  }

  renderContent() {
    const { current } = this.props;
    if (!current) {
      return (
        <div className="doc-project-empty">
          <Empty description="暂无文档" />
          {this.canEdit() ? <Button type="primary" onClick={this.createNewGroup}>新建分组</Button> : null}
        </div>
      );
    }
    return (
      <div className="interface-content doc-project-content">
        <DocsWorkspace
          ref={this.workspaceRef}
          canEdit={this.canEdit()}
          dirty={this.isDirty()}
          fileName={docFileName(current, this.state.title)}
          mode={this.state.mode}
          title={this.state.title}
          content={this.state.content}
          onModeChange={mode => this.setState({ mode })}
          onTitleChange={title => this.setState({ title })}
          onContentChange={content => this.setState({ content })}
          onActiveHeadingChange={this.setActiveTocId}
          onSave={this.saveDoc}
        />
      </div>
    );
  }

  renderSideHeader() {
    const isTocMode = this.state.navMode === 'toc';
    if (this.state.searchMode) {
      return (
        <div className="doc-side-searchbar">
          <button type="button" className="doc-nav-icon-btn" onClick={this.exitSearchMode} aria-label="退出搜索">
            <Icon type="arrow-left" />
          </button>
          <Input
            ref={this.searchInputRef}
            className="doc-side-search-input"
            onChange={e => this.setState({ filter: e.target.value })}
            value={this.state.filter}
            placeholder="搜索文档"
            autoFocus
          />
        </div>
      );
    }

    return (
      <div className="doc-side-navbar">
        <button type="button" className="doc-nav-icon-btn" onClick={this.toggleNavMode} aria-label={isTocMode ? '切换到文档列表' : '切换到目录'}>
          <Icon type={isTocMode ? 'bars' : 'file-text'} />
        </button>
        <div className="doc-side-title">{isTocMode ? 'OUTLINE' : '文档列表'}</div>
        <div className="doc-side-nav-actions">
          {this.canEdit() ? (
            <Tooltip title="新建分组">
              <button type="button" className="doc-nav-icon-btn" onClick={this.createNewGroup} aria-label="新建分组">
                <Icon type="folder-add" />
              </button>
            </Tooltip>
          ) : null}
          <button type="button" className="doc-nav-icon-btn" onClick={this.enterSearchMode} aria-label="搜索文档">
            <Icon type="search" />
          </button>
        </div>
      </div>
    );
  }

  renderDocList(selectedKey) {
    return (
      <React.Fragment>
        <div className="tree-wrappper">
          <Tree
            key={this.defaultTreeExpandedKeys().join('-')}
            className="interface-list"
            selectedKeys={[String(selectedKey)]}
            expandedKeys={this.currentDocExpandedKeys()}
            onExpand={this.onDocExpand}
            onSelect={this.onSelect}
            draggable
            onDrop={this.onDrop}
            treeData={this.buildTreeData()}
          />
        </div>
      </React.Fragment>
    );
  }

  renderSideToc() {
    const current = this.props.current;
    if (!current) {
      return <div className="doc-side-empty">请选择文档</div>;
    }
    const headings = this.filteredDocHeadings();
    if (!headings.length) {
      return <div className="doc-side-empty">{this.state.searchMode ? '无匹配项' : '暂无目录'}</div>;
    }
    return (
      <div className="doc-side-toc">
        {headings.map(heading => (
          <button
            key={heading.id}
            type="button"
            className={`doc-side-toc-item level-${heading.level}${heading.id === this.state.activeTocId ? ' active' : ''}`}
            onClick={() => this.jumpToDocHeading(heading)}
          >
            {heading.text}
          </button>
        ))}
      </div>
    );
  }

  renderSideNav(selectedKey) {
    const showList = this.state.searchMode || this.state.navMode !== 'toc';
    return (
      <React.Fragment>
        {this.renderSideHeader()}
        {showList ? this.renderDocList(selectedKey) : this.renderSideToc()}
      </React.Fragment>
    );
  }

  render() {
    const selectedDocId = this.docIdFromPath(this.props.location && this.props.location.pathname);
    const selectedKey = selectedDocId ? `doc_${selectedDocId}` : 'root';
    return (
      <Layout style={{ height: LAYOUT.PROJECT_CONTENT_HEIGHT, marginLeft: LAYOUT.PAGE_GAP, marginTop: LAYOUT.PAGE_GAP, overflow: 'hidden' }}>
        <Sider style={{ height: '100%' }} width={LAYOUT.SIDE_WIDTH}>
          <div className="left-menu doc-project-menu">
            {this.renderSideNav(selectedKey)}
          </div>
        </Sider>
        <Layout>
          <Content
            style={{
              height: '100%',
              margin: '0 16px 0 12px',
              overflow: 'initial',
              backgroundColor: '#fff'
            }}
          >
            <div className="right-content">{this.renderContent()}</div>
            <Modal
              title={isDocGroup(this.state.renameDoc) ? '修改分类' : '重命名文档'}
              open={this.state.renameVisible}
              onOk={this.submitRename}
              onCancel={() => this.setState({ renameVisible: false, renameDoc: null, renameTitle: '' })}
              okText="确认"
              cancelText="取消"
            >
              <Input
                value={this.state.renameTitle}
                onChange={e => this.setState({ renameTitle: e.target.value })}
                placeholder="文档标题"
              />
            </Modal>
            <Modal
              title="当前文档有未保存修改"
              open={this.state.confirmVisible}
              onCancel={() => this.setState({ confirmVisible: false, pendingDocId: null })}
              footer={[
                <Button key="cancel" onClick={() => this.setState({ confirmVisible: false, pendingDocId: null })}>取消</Button>,
                <Button key="discard" onClick={this.continueToPendingDoc}>放弃修改</Button>,
                <Button key="save" type="primary" onClick={this.saveAndContinue}>保存并切换</Button>
              ]}
            >
              <p>切换文档会离开当前编辑内容，请选择如何处理未保存修改。</p>
            </Modal>
          </Content>
        </Layout>
      </Layout>
    );
  }
}
