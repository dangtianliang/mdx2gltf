## 问题分析

从错误信息和代码分析中发现，问题出在war3-model库的使用方式上：

- **错误信息**：`TypeError: window.parseMDX is not a function`
- **根本原因**：war3-model库的浏览器版本将功能挂载到`window.war3model`对象上，而不是直接暴露`window.parseMDX`函数

## 解决方案

修改`exporter.html`文件中的代码，将所有的`window.parseMDX`调用替换为`window.war3model.parseMDX`：

1. **修改预览模型函数**：
   - 将`const model = window.war3Model ? window.war3Model.parseMDX(buffer) : window.parseMDX(buffer);`
   - 替换为`const model = window.war3model.parseMDX(buffer);`

2. **修改转换函数**：
   - 同样将转换函数中的MDX解析代码更新为正确的调用方式

3. **确保库加载正确**：
   - 验证war3-model库的CDN链接是否正确
   - 确保库在使用前已完全加载

## 预期结果

- 修复模型解析失败的问题
- 确保MDX模型能够正确解析和预览
- 确保转换功能能够正常工作
- 保持其他功能的完整性