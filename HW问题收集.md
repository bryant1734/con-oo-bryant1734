## HW 问题收集

列举在HW 1、HW1.1过程里，你所遇到的2\~3个通过自己学习已经解决的问题，和2\~3个尚未解决的问题与挑战

### 已解决

1. 啥是"标量derived store" 有啥作用？
   1. **上下文**：Coding Agent 说："UI 的棋盘、输入、Undo/Redo、胜利判断、分享编码全部直接读取领域对象公开接口；允许保留少量标量 derived store，但不再生成板级 view model。"
   2. **解决手段**：查看 `src/node_modules/@sudoku/stores/grid.js` 的实现。`gameView` 是一个 writable store，持有 `Game.getSnapshot()` 返回的 plain object（标量状态）。其他 derived stores 如 `userGridView`、`invalidCells`、`canUndo`、`canRedo`、`won` 都从 `gameView` 派生。这样设计的好处是：领域对象（Game/Sudoku）的变化通过 adapter 层同步到 `gameView`，Svelte 的响应式系统会自动通知所有订阅者。

2. 为什么直接修改二维数组元素，Svelte 有时不更新？
   1. **上下文**：在作业要求中提到"直接改二维数组元素，有时 Svelte 不会按预期刷新"
   2. **解决手段**：通过阅读 DESIGN.md 和 grid.js 理解到：Svelte 的响应式基于 store 的 `set()` 调用触发。如果绕过 store 直接修改数组引用，Svelte 检测不到变化。本项目中所有写操作都通过 `userGrid.set()` -> `game.guess()` -> `syncFromGame()` -> `gameView.set(...)` 链路，确保响应式更新。

### 未解决

1. `isSameArea` 函数的具体作用是什么？
   1. **上下文**：`src/components/Board/index.svelte`
      ```javascript
      sameArea={$settings.highlightCells && !isSelected($cursor, x, y) && isSameArea($cursor, x, y)}
      ```
   2. **尝试解决手段**：阅读代码后理解：`isSameArea` 判断 cell 是否与 cursor 在同一行、同一列或同一个 3x3 宫内。当 `highlightCells` 开启时，同区域的 cell 会被高亮。但不确定这个设计是为了引导玩家还是有其他 UX 考虑？

2. `gamePaused` 状态是如何控制游戏流程的？
   1. **上下文**：`src/components/Board/index.svelte` 使用 `class:bg-gray-200={$gamePaused}` 来禁用棋盘
   2. **尝试解决手段**：查看 `game.js` 了解到它是个 writable store，但不确定它与用户输入的拦截是如何联动的