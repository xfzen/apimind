import React, { PureComponent as Component } from 'react'
import PropTypes from 'prop-types'
import { Form, Input, Select, Button } from 'antd';

import constants from '../../../../constants/variable.js'
import { handleApiPath, nameLengthLimit } from '../../../../common.ts'
const HTTP_METHOD = constants.HTTP_METHOD;
const HTTP_METHOD_KEYS = Object.keys(HTTP_METHOD);

const FormItem = Form.Item;
const Option = Select.Option;
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
    catid: PropTypes.number,
    catdata: PropTypes.array
  }
  handleSubmit = e => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    this.props.form
      .validateFields()
      .then(values => {
        this.props.onSubmit(values, () => {
          this.props.form.resetFields();
        });
      })
      .catch(() => {});
  };

  handlePath = (e) => {
    let val = e.target.value
    this.props.form.setFieldsValue({
      path: handleApiPath(val)
    })
  }
  render() {
    const { getFieldsError } = this.props.form;
    const prefixSelector = (
      <FormItem name="method" initialValue="GET" noStyle>
      <Select style={{ width: 75 }}>
        {HTTP_METHOD_KEYS.map(item => {
          return <Option key={item} value={item}>{item}</Option>
        })}
      </Select>
      </FormItem>
    );
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
          label="接口分类"
        >
          <FormItem
            name="catid"
            initialValue={this.props.catid ? this.props.catid + '' : this.props.catdata[0]._id + ''}
            noStyle
          >
            <Select>
              {this.props.catdata.map(item => {
                return <Option key={item._id} value={item._id + ""}>{item.name}</Option>
              })}
            </Select>
          </FormItem>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="接口名称"
        >
          <FormItem name="title" rules={nameLengthLimit('接口')} noStyle>
            <Input placeholder="接口名称" />
          </FormItem>
        </FormItem>

        <FormItem
          {...formItemLayout}
          label="接口路径"
        >
          <FormItem
            name="path"
            rules={[{
              required: true, message: '请输入接口路径!'
            }]}
            noStyle
          >
            <Input onBlur={this.handlePath} addonBefore={prefixSelector} placeholder="/path" />
          </FormItem>
        </FormItem>
        <FormItem
          {...formItemLayout}
          label="注"
        >
          <span style={{ color: "#929292" }}>详细的接口数据可以在编辑页面中添加</span>
        </FormItem>
        <FormItem className="catModalfoot" wrapperCol={{ span: 24, offset: 8 }} >
          <Button onClick={this.props.onCancel} style={{ marginRight: "10px" }}  >取消</Button>
          <Button
            type="primary"
            htmlType="submit"
            disabled={hasErrors(getFieldsError())}
          >
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
