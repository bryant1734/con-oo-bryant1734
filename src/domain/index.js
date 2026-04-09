const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;

function createEmptyGrid() {
	return Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0));
}

function cloneGrid(grid) {
	return grid.map((row) => row.slice());
}

function cloneInvalidPositions(invalidPositions) {
	return invalidPositions.map(({ row, col }) => ({ row, col }));
}

function assertGrid9x9(grid, source = 'grid') {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new TypeError(`${source} must be a 9x9 number matrix`);
	}

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		if (!Array.isArray(grid[row]) || grid[row].length !== SUDOKU_SIZE) {
			throw new TypeError(`${source} must be a 9x9 number matrix`);
		}

		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const cell = grid[row][col];
			if (!Number.isInteger(cell) || cell < 0 || cell > SUDOKU_SIZE) {
				throw new TypeError(`${source}[${row}][${col}] must be an integer in [0, 9]`);
			}
		}
	}
}

function normalizeGrid(input) {
	const grid = input ?? createEmptyGrid();
	assertGrid9x9(grid, 'input');
	return cloneGrid(grid);
}

function normalizeMove(move) {
	if (!move || typeof move !== 'object') {
		throw new TypeError('move must be an object');
	}

	const { row, col, value } = move;
	if (!Number.isInteger(row) || row < 0 || row >= SUDOKU_SIZE) {
		throw new RangeError('move.row must be an integer in [0, 8]');
	}
	if (!Number.isInteger(col) || col < 0 || col >= SUDOKU_SIZE) {
		throw new RangeError('move.col must be an integer in [0, 8]');
	}

	const normalizedValue = value === null ? 0 : value;
	if (!Number.isInteger(normalizedValue) || normalizedValue < 0 || normalizedValue > SUDOKU_SIZE) {
		throw new RangeError('move.value must be an integer in [0, 9] (or null)');
	}

	return { row, col, value: normalizedValue };
}

function formatSudoku(grid) {
	const lines = [];
	lines.push('    1 2 3   4 5 6   7 8 9');
	lines.push('  +-------+-------+-------+');

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		const chunks = [];
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			chunks.push(grid[row][col] === 0 ? '.' : String(grid[row][col]));
		}

		lines.push(
			`${row + 1} | ${chunks.slice(0, 3).join(' ')} | ${chunks.slice(3, 6).join(' ')} | ${chunks.slice(6, 9).join(' ')} |`,
		);

		if ((row + 1) % BOX_SIZE === 0) {
			lines.push('  +-------+-------+-------+');
		}
	}

	return lines.join('\n');
}

function collectInvalidPositions(grid) {
	const invalid = new Set();

	function markRow(row) {
		const seen = new Map();
		for (let col = 0; col < SUDOKU_SIZE; col++) {
			const value = grid[row][col];
			if (value === 0) {
				continue;
			}

			if (!seen.has(value)) {
				seen.set(value, []);
			}
			seen.get(value).push({ row, col });
		}

		for (const positions of seen.values()) {
			if (positions.length > 1) {
				for (const position of positions) {
					invalid.add(`${position.row},${position.col}`);
				}
			}
		}
	}

	function markColumn(col) {
		const seen = new Map();
		for (let row = 0; row < SUDOKU_SIZE; row++) {
			const value = grid[row][col];
			if (value === 0) {
				continue;
			}

			if (!seen.has(value)) {
				seen.set(value, []);
			}
			seen.get(value).push({ row, col });
		}

		for (const positions of seen.values()) {
			if (positions.length > 1) {
				for (const position of positions) {
					invalid.add(`${position.row},${position.col}`);
				}
			}
		}
	}

	function markBox(startRow, startCol) {
		const seen = new Map();
		for (let row = startRow; row < startRow + BOX_SIZE; row++) {
			for (let col = startCol; col < startCol + BOX_SIZE; col++) {
				const value = grid[row][col];
				if (value === 0) {
					continue;
				}

				if (!seen.has(value)) {
					seen.set(value, []);
				}
				seen.get(value).push({ row, col });
			}
		}

		for (const positions of seen.values()) {
			if (positions.length > 1) {
				for (const position of positions) {
					invalid.add(`${position.row},${position.col}`);
				}
			}
		}
	}

	for (let row = 0; row < SUDOKU_SIZE; row++) {
		markRow(row);
	}

	for (let col = 0; col < SUDOKU_SIZE; col++) {
		markColumn(col);
	}

	for (let startRow = 0; startRow < SUDOKU_SIZE; startRow += BOX_SIZE) {
		for (let startCol = 0; startCol < SUDOKU_SIZE; startCol += BOX_SIZE) {
			markBox(startRow, startCol);
		}
	}

	return Array.from(invalid, (key) => {
		const [row, col] = key.split(',').map(Number);
		return { row, col };
	});
}

function analyzeGrid(grid) {
	const invalidPositions = collectInvalidPositions(grid);
	const complete = grid.every((row) => row.every((cell) => cell !== 0));
	const solved = complete && invalidPositions.length === 0;

	return {
		invalidPositions,
		complete,
		solved,
	};
}

function normalizeSnapshot(snapshot, source = 'snapshot') {
	if (!snapshot || typeof snapshot !== 'object') {
		throw new TypeError(`${source} must be an object`);
	}

	const sudoku = createSudokuFromJSON(snapshot);
	return sudoku.toJSON();
}

export function createSudoku(input) {
	let grid = normalizeGrid(input);

	return {
		getGrid() {
			return cloneGrid(grid);
		},

		guess(move) {
			const { row, col, value } = normalizeMove(move);
			grid[row][col] = value;
		},

		validate() {
			const analysis = analyzeGrid(grid);
			return {
				invalidPositions: cloneInvalidPositions(analysis.invalidPositions),
				complete: analysis.complete,
				solved: analysis.solved,
			};
		},

		clone() {
			return createSudoku(grid);
		},

		toJSON() {
			return {
				grid: cloneGrid(grid),
			};
		},

		toString() {
			return formatSudoku(grid);
		},
	};
}

export function createSudokuFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new TypeError('sudoku json must be an object');
	}

	return createSudoku(json.grid);
}

function createGameWithState({ sudoku, undoStack = [], redoStack = [] }) {
	if (!sudoku || typeof sudoku.toJSON !== 'function' || typeof sudoku.validate !== 'function') {
		throw new TypeError('createGame expects a Sudoku-like object');
	}

	let timeline = [
		...undoStack.map((snapshot, index) => normalizeSnapshot(snapshot, `undoStack[${index}]`)),
		normalizeSnapshot(sudoku.toJSON(), 'sudoku'),
		...redoStack.map((snapshot, index) => normalizeSnapshot(snapshot, `redoStack[${index}]`)),
	];
	let cursor = undoStack.length;

	function getCurrentSnapshot() {
		return timeline[cursor];
	}

	function getCurrentSudoku() {
		return createSudokuFromJSON(getCurrentSnapshot());
	}

	function getUndoSnapshots() {
		return timeline.slice(0, cursor);
	}

	function getRedoSnapshots() {
		return timeline.slice(cursor + 1);
	}

	function replaceTimeline(nextSudoku) {
		timeline = [
			...timeline.slice(0, cursor + 1),
			nextSudoku.toJSON(),
		];
		cursor += 1;
	}

	return {
		getSudoku() {
			return getCurrentSudoku();
		},

		guess(move) {
			const { row, col, value } = normalizeMove(move);
			const currentSudoku = getCurrentSudoku();
			const currentGrid = currentSudoku.getGrid();

			if (currentGrid[row][col] === value) {
				return;
			}

			currentSudoku.guess({ row, col, value });
			replaceTimeline(currentSudoku);
		},

		undo() {
			if (cursor === 0) {
				return;
			}

			cursor -= 1;
		},

		redo() {
			if (cursor >= timeline.length - 1) {
				return;
			}

			cursor += 1;
		},

		canUndo() {
			return cursor > 0;
		},

		canRedo() {
			return cursor < timeline.length - 1;
		},

		getSnapshot() {
			const currentSudoku = getCurrentSudoku();
			const validation = currentSudoku.validate();

			return {
				grid: currentSudoku.getGrid(),
				invalidPositions: cloneInvalidPositions(validation.invalidPositions),
				complete: validation.complete,
				won: validation.solved,
				canUndo: cursor > 0,
				canRedo: cursor < timeline.length - 1,
			};
		},

		toJSON() {
			return {
				sudoku: normalizeSnapshot(getCurrentSnapshot(), 'currentSnapshot'),
				history: {
					undo: getUndoSnapshots().map((snapshot) => normalizeSnapshot(snapshot)),
					redo: getRedoSnapshots().map((snapshot) => normalizeSnapshot(snapshot)),
				},
			};
		},
	};
}

export function createGame({ sudoku }) {
	return createGameWithState({ sudoku });
}

export function createGameFromJSON(json) {
	if (!json || typeof json !== 'object') {
		throw new TypeError('game json must be an object');
	}

	const sudoku = createSudokuFromJSON(json.sudoku);
	const undo = Array.isArray(json.history?.undo) ? json.history.undo : [];
	const redo = Array.isArray(json.history?.redo) ? json.history.redo : [];

	return createGameWithState({
		sudoku,
		undoStack: undo,
		redoStack: redo,
	});
}
