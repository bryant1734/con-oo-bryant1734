# con-oo-bryant1734 - Review

## Review 结论

这份实现已经把 `Game/Sudoku` 接进了开始新局、界面渲染、输入、撤销重做和胜利判定等主要 Svelte 流程，说明“接入真实使用”这一目标基本达成；但领域模型仍未把“题面 givens 不可修改”这一核心业务规则内聚进去，`Game` 也更像快照时间线管理器而不是稳定的聚合根，导致 OOP/OOD 收敛度一般，Svelte 层也还保留了并行状态源。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | good |
| Sudoku Business | fair |
| OOD | fair |

## 缺点

### 1. 固定题面是否可编辑的约束没有进入领域对象

- 严重程度：core
- 位置：src/domain/index.js:208-211,287-298; src/node_modules/@sudoku/stores/grid.js:65-67,95-105
- 原因：`Sudoku.guess()` 和 `Game.guess()` 本身都可以覆盖任意格子，真正阻止修改题面 givens 的逻辑放在 Svelte 适配层的 `isEditableCell()`。这意味着领域层没有保护数独最核心的不变量，任何绕开该 store 的调用都能破坏业务规则，也削弱了 `Game` 作为 UI 统一操作入口的意义。

### 2. Game 实际管理的是 JSON 时间线，而不是稳定的 Sudoku 聚合

- 严重程度：major
- 位置：src/domain/index.js:251-285,287-297,324-345
- 原因：`getSudoku()` 每次都用当前 snapshot 重新构造 `Sudoku`，`guess()` 也先反序列化再写回 snapshot。这样虽然实现了 undo/redo，但 `Game` 并没有长期持有一个连续演进的 `Sudoku` 对象；对象身份和行为连续性被序列化过程打断，后续若要扩展观察者、领域事件或更丰富的对象协作会比较别扭。

### 3. Svelte 层仍保留旧 grid 作为并行真相源

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:53-90,93-149; src/components/Board/index.svelte:4,48-51; src/node_modules/@sudoku/stores/keyboard.js:1-10
- 原因：当前界面一部分从 `userGrid/gameView` 读取当前局面，另一部分又直接读取旧的 `grid` store 来判断 givens、冲突高亮和键盘是否可编辑；适配层内部还额外维护 `puzzleGrid`。这说明 View 没有完全收敛到单一的领域导出视图模型，状态被拆成多份，后续演化时容易出现漏同步或职责漂移。

### 4. 领域快照直接携带较多 UI 语义，边界略混杂

- 严重程度：minor
- 位置：src/domain/index.js:179-188,324-335
- 原因：`getSnapshot()` 直接产出 `won`、`canUndo`、`canRedo`、`invalidPositions` 这样的前端视图 DTO，Svelte 用起来方便，但也让 `Game` 同时承担历史管理和展示态组装。这个取舍并非错误，只是会让领域对象更容易被 UI 需求牵着走。

## 优点

### 1. 输入检查和防御性拷贝比较完整

- 位置：src/domain/index.js:16-60,204-230
- 原因：创建时会校验 9x9 结构和数值范围，`getGrid()`、`clone()`、`toJSON()` 都返回拷贝而不是内部引用，避免了外部直接污染领域对象内部状态。

### 2. 数独校验逻辑集中在领域层

- 位置：src/domain/index.js:85-188,324-335
- 原因：`validate()` 用统一的行、列、宫分析逻辑产出冲突位置、是否填满和是否胜利，说明数独完成态和非法态并没有散落在组件事件里。

### 3. 主要交互已经通过 Game/Sudoku 进入领域层

- 位置：src/node_modules/@sudoku/stores/grid.js:69-71,95-135; src/components/Controls/Keyboard.svelte:18-24; src/components/Controls/ActionBar/Actions.svelte:26-35
- 原因：数字输入、提示填数、撤销和重做都不是在组件里直接改二维数组，而是经由 `userGrid` 适配层调用 `game.guess()`、`game.undo()`、`game.redo()`，这比把关键逻辑散在 `.svelte` 文件里更符合本次作业目标。

### 4. 开始新局和胜利流程已经接上响应式链路

- 位置：src/node_modules/@sudoku/game.js:13-34; src/node_modules/@sudoku/stores/grid.js:88-90; src/App.svelte:12-31
- 原因：新游戏或自定义题面会触发重建 `Game` 并刷新 `gameView`，`won` 再通过 store 派生到 `App.svelte` 的结束流程，说明领域状态确实在驱动界面流程，而不是只存在于测试里。

## 补充说明

- 本次结论仅基于静态阅读 `src/domain/*` 及其直接相关的 Svelte 接入代码，包括 `src/node_modules/@sudoku/stores/grid.js`、`src/node_modules/@sudoku/stores/game.js`、`src/components/Board/index.svelte`、`src/components/Controls/Keyboard.svelte`、`src/components/Controls/ActionBar/Actions.svelte`、`src/App.svelte`；按要求未运行 tests，也未实际操作 UI。
- 关于撤销/重做、界面自动刷新、胜利弹窗等是否在运行时完全正确，以上判断来自代码调用链的静态推断，而非实际运行验证。
- 未扩展审查到无关目录；`notes`、`candidates`、`hints` 等模块仅在判断领域接入方式时作为上下文参考。
