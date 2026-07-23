import React, { PureComponent as Component } from 'react';
import PropTypes from 'prop-types';
import { Form, Input, Button } from 'antd';
const FormItem = Form.Item;
function hasErrors(fieldsError) {
  if (Array.isArray(fieldsError)) {
    return fieldsError.some(field => field.errors.length);
  }
  return Object.keys(fieldsError).some(field => fieldsError[field]);
}
class AddInterfaceForm extends Component {
  static propTypes = {
    form: PropTypes.object,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    catdata: PropTypes.object
  };
  handleSubmit = e => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        this.props.onSubmit(values);
      })
      .catch(() => {});
  };

  render() {
    const { getFieldsError } = this.props.form;
    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 6 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 14 }
      }
    };

    return (
      <Form form={this.props.form} onFinish={this.handleSubmit}>
        <FormItem
          {...formItemLayout}
          label="分类名"
          name="name"
          rules={[
            {
              required: true,
              message: '请输入分类名称!'
            }
          ]}
          initialValue={this.props.catdata ? this.props.catdata.name || null : null}
        >
          <Input placeholder="分类名称" />
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="备注"
          name="desc"
          initialValue={this.props.catdata ? this.props.catdata.desc || null : null}
        >
          <Input placeholder="备注" />
        </FormItem>

        <FormItem className="catModalfoot" wrapperCol={{ span: 24, offset: 8 }}>
          <Button onClick={this.props.onCancel} style={{ marginRight: '10px' }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" disabled={hasErrors(getFieldsError())}>
            提交
          </Button>
        </FormItem>
      </Form>
    );
  }
}

function AddInterfaceFormWrapper(props) {
  const [form] = Form.useForm();
  return <AddInterfaceForm {...props} form={form} />;
}

export default AddInterfaceFormWrapper;
