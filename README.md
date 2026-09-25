# Copy as Markdown

Extension cho VS Code cho phép xem cây thư mục dạng Explorer, chọn nhiều file bằng checkbox, rồi copy nội dung dưới dạng Markdown để paste vào nơi khác.

## Tính năng

- Chọn hàng loạt file bằng checkbox ở đầu tree.
- Duyệt thư mục theo dạng folder/file tree.
- Mỗi file code có checkbox riêng để chọn.
- Nút Copy, Refresh, Clear selection, Select all trong header của view.
- Click vào file sẽ mở file trong VS Code.
- Tự động tạo Markdown gồm heading path và code fence theo ngôn ngữ.

## Output mẫu

Nếu chọn file `src/app.ts`, output sẽ là:

```markdown
### src/app.ts

```typescript
console.log('hello');
```
```

## Cài đặt và chạy local

1. Cài Node.js + npm nếu máy chưa có.
2. Từ workspace root, chạy:

```bash
npm install
npm run compile
```

3. Mở VS Code, nhấn F5 để chạy Extension Development Host.
4. Trong host mới, mở view Copy as Markdown từ Activity Bar.

## Đóng gói

```bash
npx @vscode/vsce package
```

Sau đó bạn có thể cài `.vsix` qua VS Code → Extensions → ... → Install from VSIX.
