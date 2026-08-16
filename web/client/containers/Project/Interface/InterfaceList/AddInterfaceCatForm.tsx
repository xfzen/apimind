import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { Form, Input, Button } from 'antd';
import type { FormInstance } from 'antd';
const FormItem = Form.Item;
type FormErrors = Array<{ errors: string[] }> | Record<string, unknown>;
function hasErrors(fieldsError: FormErrors): boolean {
  if (Array.isArray(fieldsError)) {
    return fieldsError.some(field => field.errors.length);
  }
  return Object.keys(fieldsError).some(field => fieldsError[field]);
}
interface CategoryFormValues { name: string; desc?: string }
interface CategoryData { name?: string; desc?: string }
interface AddInterfaceCatProps {
  form: FormInstance<CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel: () => void;
  catdata?: CategoryData;
}
class AddInterfaceForm extends Component<AddInterfaceCatProps> {
  static propTypes = {
    form: PropTypes.object,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    catdata: PropTypes.object
  };
  handleSubmit = () => {
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
      <Form form={this.props.form} onFinish={() => this.handleSubmit()}>
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

type AddInterfaceCatOwnProps = Omit<AddInterfaceCatProps, 'form'>;
const ConnectedAddInterfaceForm = AddInterfaceForm as unknown as ComponentType<AddInterfaceCatProps>;
function AddInterfaceFormWrapper(props: AddInterfaceCatOwnProps) {
  const [form] = Form.useForm();
  return <ConnectedAddInterfaceForm {...props} form={form} />;
}

export default AddInterfaceFormWrapper;
