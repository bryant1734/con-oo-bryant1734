# Homework 1.1 设计说明

## A. 领域对象如何被消费

### 1. View 层直接消费的是什么

View 层直接消费的不是裸 `Game` / `Sudoku`，而是一个面向 Svelte 的 store adapter：

- `userGrid`
- `invalidCells`
- `canUndo`
- `canRedo`
- `won`

这些状态都定义在 `src/node_modules/@sudoku/stores/grid.js`。它内部持有一个 `Game` 实例，再把 `Game.getSnapshot()` 返回的 plain data 推给 Svelte store。

本次我采用的是作业要求推荐的 `Store Adapter` 方案：

- 领域层: `src/domain/index.js`
- 适配层: `src/node_modules/@sudoku/stores/grid.js`
- View 层: `.svelte` 组件只读取 store、调用 store 方法

### 2. View 层拿到的数据是什么

`Game.getSnapshot()` 会返回适合 UI 消费的普通对象:

- `grid`
- `invalidPositions`
- `complete`
- `won`
- `canUndo`
- `canRedo`

adapter 再把它翻译成 Svelte 直接使用的状态:

- `userGrid`: 当前渲染的棋盘
- `invalidCells`: 冲突格，格式是 `x,y`
- `canUndo` / `canRedo`: 撤销与重做按钮状态
- `won`: 当前是否已经完成且无冲突

### 3. 用户操作如何进入领域对象

用户操作不会直接修改二维数组，而是统一先进入 adapter，再调用领域对象。

主要流程如下:

1. 开始一局游戏
   - `src/node_modules/@sudoku/game.js` 中的 `startNew()` / `startCustom()` 更新题盘 store `grid`
   - `grid.subscribe(...)` 会在 `src/node_modules/@sudoku/stores/grid.js` 中重建一个新的 `Game`

2. 用户输入数字
   - `src/components/Controls/Keyboard.svelte` 调用 `userGrid.set($cursor, num)`
   - adapter 内部转成 `game.guess({ row, col, value })`

3. 用户点击 Hint
   - `src/components/Controls/ActionBar/Actions.svelte` 调用 `userGrid.applyHint($cursor)`
   - adapter 从题盘的解答中取提示值，再调用 `game.guess(...)`

4. Undo / Redo
   - `Actions.svelte` 中按钮分别调用 `userGrid.undo()` / `userGrid.redo()`
   - adapter 内部转发到 `game.undo()` / `game.redo()`

### 4. 领域对象变化后，Svelte 为什么会更新

关键在 `syncFromGame()`:

1. adapter 调用 `game.getSnapshot()`
2. 把返回的 plain data 用 `gameView.set(...)` 推进 Svelte store
3. `userGrid`、`invalidCells`、`canUndo`、`canRedo`、`won` 都从这个 store 派生
4. 组件通过 `$store` 订阅这些值，所以 store 更新后界面会自动刷新

也就是说:

- 领域对象本身不直接处理 Svelte 响应式
- 响应式边界放在 adapter store
- View 层消费的是“领域对象导出的响应式快照”

## B. 响应式机制说明

### 1. 依赖的 Svelte 机制

本实现依赖的是 Svelte 3 的:

- `writable(...)`
- `derived(...)`
- 组件中的 `$store`

没有升级到 Svelte 5，也没有使用 runes 或 reactive class。

### 2. 哪些数据是响应式暴露给 UI 的

响应式暴露给 UI 的状态有:

- `userGrid`
- `invalidCells`
- `canUndo`
- `canRedo`
- `won`
- `gameWon`

这些都是 plain data，不把 `Game` 内部对象直接暴露给组件。

### 3. 哪些状态留在领域对象内部

保留在领域对象内部的状态有:

- `Sudoku` 内部真实 `grid`
- `Sudoku.validate()` 的校验逻辑
- `Game` 内部时间线 `timeline`
- `Game` 内部游标 `cursor`
- Undo / Redo 的分支截断逻辑

组件并不知道历史如何存，也不知道校验细节，只知道调用 `guess()` / `undo()` / `redo()`。

### 4. 如果直接 mutate 内部对象，会出现什么问题

如果错误地直接改:

- `Game` 内部字段
- `Sudoku` 内部 `grid[row][col]`
- 组件拿到的二维数组引用

就会有两个问题:

1. Svelte 不一定知道状态变了，因为没有触发 store 的 `set(...)`
2. 会绕过领域规则，导致 Undo / Redo、校验和获胜判断不同步

所以我这里强制所有写操作都走:

`View -> store adapter -> Game -> Sudoku -> snapshot -> Svelte store`

## C. 改进说明

### 1. 相比 HW1，我改进了什么

这次的主要改进有四点:

1. 真正把领域对象接进了真实 Svelte 流程
   - 键盘输入、Hint、Undo、Redo 都经过 `Game`

2. 把校验能力补进了 `Sudoku`
   - `Sudoku.validate()` 负责返回 `invalidPositions`、`complete`、`solved`

3. 给 `Game` 增加了 `getSnapshot()`
   - 领域层主动导出 UI 需要的 plain data
   - adapter 不再自己重新推导冲突和胜利条件

4. 改进了 history 的存储方式
   - `Game` 内部不是存活的 `Sudoku` 对象列表，而是存可序列化的快照时间线
   - 这样 Undo / Redo、序列化、反序列化都共用同一套数据结构

### 2. 为什么 HW1 的做法不足以支撑真实接入

HW1 里最典型的问题是:

- 领域对象可以单独测试
- 但真实界面仍然容易直接操作旧数组
- 组件自己推导冲突、胜利和历史状态

这样会导致“测试里像是 OO，运行时却不是 OO 驱动”。这次补上的核心链路是:

`View -> Store Adapter -> Game -> Sudoku`

### 3. 新设计的 trade-off

这个设计有明显 trade-off:

1. 优点
   - 领域逻辑集中
   - 组件更薄
   - UI 更新机制可解释
   - 如果以后换 UI 框架，`Sudoku` / `Game` 基本还能复用

2. 代价
   - 多了一层 adapter
   - 每次状态变化都要显式同步快照
   - history 仍然是快照式，不是最省内存的 move log

我接受这个 trade-off，因为本次作业重点是“真实接入”和“响应式边界清楚”，不是极限性能。

## 领域对象职责边界

### `Sudoku`

`Sudoku` 负责“局面本身”:

- 持有当前 `grid`
- 提供 `guess(move)`
- 提供 `validate()`
- 提供 `getGrid()`、`clone()`、`toJSON()`、`toString()`

它不负责历史，也不负责 Svelte。

### `Game`

`Game` 负责“游戏会话”:

- 持有当前 `Sudoku`
- 管理时间线历史
- 提供 `guess()` / `undo()` / `redo()`
- 提供 `canUndo()` / `canRedo()`
- 提供 `getSnapshot()` 给 adapter 消费
- 提供 `toJSON()` / `createGameFromJSON(...)`

它不关心按钮、组件、`$store` 这些 UI 细节。

## 复制策略与序列化

### 深拷贝策略

以下位置都使用二维数组深拷贝:

- `createSudoku(input)`
- `Sudoku.getGrid()`
- `Sudoku.clone()`
- `Sudoku.toJSON()`
- `Game` 存储历史快照时

这样可以避免:

- 外部修改输入污染内部状态
- 克隆对象共享嵌套数组
- 撤销历史被后续输入串改

### 序列化设计

`Sudoku.toJSON()` 只输出:

- `grid`

`Game.toJSON()` 输出:

- 当前 `sudoku`
- `history.undo`
- `history.redo`

`createSudokuFromJSON(...)` 和 `createGameFromJSON(...)` 会重新构造领域对象实例，不会把 plain object 直接当成领域对象继续用。

## 课堂提问可直接回答

1. View 层直接消费的是谁?
   - `userGrid` 等 store adapter，而不是裸 `Game`

2. 为什么 UI 在领域对象变化后会刷新?
   - 因为 adapter 在每次变更后都会调用 `gameView.set(...)`，Svelte store 会通知订阅者

3. 响应式边界在哪里?
   - 在 `Game` 与 Svelte store 之间，也就是 adapter 层

4. 哪些状态对 UI 可见，哪些不可见?
   - 可见的是 `grid`、`invalidCells`、`canUndo`、`canRedo`、`won`
   - 不可见的是 `Sudoku` 内部真实数组引用、`Game` 的时间线和游标

5. 如果以后迁移到 Svelte 5，哪层最稳定，哪层最可能改动?
   - 最稳定的是 `Sudoku` / `Game`
   - 最可能改动的是 adapter 层，因为它直接依赖当前 Svelte store API
