#!/usr/bin/env python3
"""
清理 exporter.html 文件中的调试代码
1. 保留 sendLog 函数定义，但移除所有 sendLog 调用
2. 移除所有 console.log 调用
3. 保留核心的 GLTF 导出和动画转换功能
4. 保留动画重定向逻辑（Object06 -> gutz00）
"""

import re

def clean_js_code(content):
    """清理 JavaScript 代码中的调试语句"""
    
    # 首先，保留 sendLog 函数定义，但移除所有 sendLog 调用
    # sendLog 函数定义在 534-552 行左右
    
    # 1. 移除 console.log 调用（包括多行的情况）
    # 匹配 console.log(...); 或 console.log(...) 后面跟换行符的情况
    
    # 先处理简单的单行 console.log
    content = re.sub(r'\s*console\.log\([^)]*\);?\s*\n', '\n', content)
    
    # 处理多行 console.log（带嵌套括号的情况）
    def remove_multiline_console_log(match):
        return ''
    
    # 使用更精确的模式来匹配多行 console.log
    pattern = r'console\.log\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?'
    content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)
    
    # 2. 移除 console.warn 调用（保留错误日志）
    content = re.sub(r'\s*console\.warn\([^)]*\);?\s*\n', '\n', content)
    content = re.sub(r'console\.warn\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?', '', content, flags=re.MULTILINE | re.DOTALL)
    
    # 3. 移除 console.error 调用（保留错误日志，但移除调试用的）
    # 保留真正的错误日志，只移除那些带有特定前缀的调试错误日志
    content = re.sub(r'\s*console\.error\([\'"]❌[^)]*\);?\s*\n', '\n', content)
    content = re.sub(r'\s*console\.error\([\'"]🎬[^)]*\);?\s*\n', '\n', content)
    content = re.sub(r'\s*console\.error\([\'"]🧪[^)]*\);?\s*\n', '\n', content)
    
    # 4. 移除 sendLog 调用（但保留函数定义）
    # sendLog 调用通常是这样的：try { sendLog(...); } catch (e) { ... }
    # 或者简单的 sendLog(...);
    
    # 移除 try { sendLog(...); } catch (e) { console.warn(...); } 块
    pattern = r'\s*try\s*{\s*sendLog\([^}]*\);\s*}\s*catch\s*\([^)]*\)\s*{\s*console\.warn\([^)]*\);?\s*}\s*'
    content = re.sub(pattern, '\n', content, flags=re.MULTILINE | re.DOTALL)
    
    # 移除单独的 sendLog 调用
    pattern = r'sendLog\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\);?'
    content = re.sub(pattern, '', content, flags=re.MULTILINE | re.DOTALL)
    
    # 5. 移除调试用的注释块（包含特定调试标记的注释）
    # 移除包含 "调试"、"日志"、"测试" 等字样的单行注释
    content = re.sub(r'\s*//\s*(?:调试|日志|测试|debug|log|test)[^\n]*\n', '\n', content, flags=re.IGNORECASE)
    
    # 6. 清理多余的空行（连续3个或更多换行符替换为2个）
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 7. 移除特定的调试代码块
    # 移除 window._testObj 相关的调试代码
    content = re.sub(r'\s*window\._testObj\s*=\s*[^;]*;?\s*', '\n', content)
    
    # 8. 移除 frameCount 相关的调试代码
    content = re.sub(r'\s*if\s*\([^)]*frameCount[^)]*\)\s*{[^}]*}\s*', '\n', content, flags=re.MULTILINE | re.DOTALL)
    content = re.sub(r'\s*window\.frameCount\s*=\s*[^;]*;?\s*', '\n', content)
    
    return content

def main():
    input_file = r'e:\mdx-m3-viewer-master\clients\model-viewer\exporter.html'
    output_file = r'e:\mdx-m3-viewer-master\clients\model-viewer\exporter_cleaned.html'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"原始文件大小: {len(content)} 字符")
    
    # 清理代码
    cleaned_content = clean_js_code(content)
    
    print(f"清理后文件大小: {len(cleaned_content)} 字符")
    print(f"减少了: {len(content) - len(cleaned_content)} 字符")
    
    # 保存清理后的文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)
    
    print(f"清理后的文件已保存到: {output_file}")
    
    # 验证 sendLog 函数定义是否保留
    if 'function sendLog(' in cleaned_content:
        print("✓ sendLog 函数定义已保留")
    else:
        print("✗ sendLog 函数定义未找到！")
    
    # 验证动画重定向逻辑是否保留
    if "boneName = 'gutz00'" in cleaned_content:
        print("✓ 动画重定向逻辑已保留")
    else:
        print("✗ 动画重定向逻辑未找到！")

if __name__ == '__main__':
    main()
