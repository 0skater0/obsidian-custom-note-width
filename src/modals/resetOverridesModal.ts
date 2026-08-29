import { App, Modal } from "obsidian";
import { t } from "src/i18n/i18n";
import { WidthValue } from "src/utility/config";

interface Row
{
	path: string;
	container: HTMLDivElement;
	checkbox: HTMLInputElement;
}

/**
 * Modal with a searchable checkbox list of local per-note overrides.
 * The user picks which ones to remove; the caller receives the selected paths on confirm.
 */
export default class ResetOverridesModal extends Modal
{
	private rows: Row[] = [];
	private selectAllBox: HTMLInputElement | null = null;
	private selectAllLabel: HTMLLabelElement | null = null;
	private removeBtn: HTMLButtonElement | null = null;
	private emptyEl: HTMLDivElement | null = null;
	private filter = "";

	/**
	 * Constructs a new ResetOverridesModal.
	 * @param app - The Obsidian application instance.
	 * @param overrides - Map of file paths to their stored WidthValue.
	 * @param onConfirm - Callback invoked with the paths the user chose to remove.
	 */
	constructor(
		app: App,
		private overrides: Record<string, WidthValue>,
		private onConfirm: (paths: string[]) => void | Promise<void>,
	)
	{
		super(app);
	}

	/** Opens the modal and builds its content. */
	public onOpen(): void
	{
		const { contentEl, titleEl } = this;
		titleEl.setText(t("modal.reset_overrides.title"));

		const paths = Object.keys(this.overrides).sort();

		contentEl.createEl("p", {
			text: t("modal.reset_overrides.desc", { count: paths.length }),
		});

		this.renderSearch(contentEl);
		this.renderSelectAll(contentEl);
		this.renderList(contentEl, paths);
		this.renderButtons(contentEl);
		this.applyFilter();
	}

	/** Search input; live-filters the list. */
	private renderSearch(container: HTMLElement): void
	{
		const input = container.createEl("input", { type: "text", cls: "cnw-reset-search" });
		input.placeholder = t("modal.reset_overrides.search_placeholder");
		input.oninput = () =>
		{
			this.filter = input.value.trim().toLowerCase();
			this.applyFilter();
		};
	}

	/** Master "select all" checkbox row; operates on the currently visible rows. */
	private renderSelectAll(container: HTMLElement): void
	{
		const row = container.createDiv({ cls: "cnw-reset-select-all" });

		this.selectAllBox = row.createEl("input", { type: "checkbox" });
		this.selectAllBox.checked = true;
		this.selectAllBox.id = "cnw-select-all";
		this.selectAllBox.onchange = () =>
		{
			const target = this.selectAllBox?.checked ?? false;
			for (const r of this.visibleRows())
			{
				r.checkbox.checked = target;
			}
			this.syncSelectAll();
			this.refreshRemoveButton();
		};

		this.selectAllLabel = row.createEl("label", { cls: "cnw-reset-select-all-label" });
		this.selectAllLabel.htmlFor = "cnw-select-all";
	}

	/** Scrollable list; one row per override. */
	private renderList(container: HTMLElement, paths: string[]): void
	{
		const listEl = container.createDiv({ cls: "cnw-reset-list" });

		for (const path of paths)
		{
			const wv = this.overrides[path];
			const row = listEl.createDiv({ cls: "cnw-reset-row" });

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = true;
			checkbox.id = `cnw-reset-${this.rows.length}`;
			checkbox.onchange = () =>
			{
				this.syncSelectAll();
				this.refreshRemoveButton();
			};

			const label = row.createEl("label", { cls: "cnw-reset-row-label" });
			label.htmlFor = checkbox.id;
			label.setText(path);
			label.title = path;

			row.createSpan({ text: `${wv.value}${wv.unit}`, cls: "cnw-reset-value" });

			this.rows.push({ path, container: row, checkbox });
		}

		this.emptyEl = listEl.createDiv({ text: t("modal.reset_overrides.empty_filter"), cls: "cnw-reset-empty" });
	}

	/** Cancel / Remove buttons. */
	private renderButtons(container: HTMLElement): void
	{
		const buttonRow = container.createDiv({ cls: "cnw-reset-button-row" });

		const cancelBtn = buttonRow.createEl("button", { text: t("button.cancel") });
		cancelBtn.onclick = () => this.close();

		this.removeBtn = buttonRow.createEl("button", { cls: "mod-warning" });
		this.removeBtn.onclick = async () =>
		{
			const paths = this.rows.filter((r) => r.checkbox.checked).map((r) => r.path);
			this.close();
			await this.onConfirm(paths);
		};
	}

	/** Show or hide each row based on the current filter. */
	private applyFilter(): void
	{
		let visible = 0;
		for (const r of this.rows)
		{
			const match = this.filter === "" || r.path.toLowerCase().includes(this.filter);
			r.container.toggleClass("cnw-hidden", !match);
			if (match) visible++;
		}
		if (this.emptyEl)
		{
			this.emptyEl.toggleClass("cnw-visible", visible === 0);
		}
		this.syncSelectAll();
		this.refreshRemoveButton();
	}

	/** All rows currently passing the filter. */
	private visibleRows(): Row[]
	{
		return this.rows.filter((r) => !r.container.hasClass("cnw-hidden"));
	}

	/**
	 * Master checkbox reflects the state of the *visible* rows.
	 * Its label counts them, so the user always sees what the toggle will act on.
	 */
	private syncSelectAll(): void
	{
		if (!this.selectAllBox || !this.selectAllLabel) return;
		const visible = this.visibleRows();
		const checkedVisible = visible.filter((r) => r.checkbox.checked).length;
		this.selectAllBox.checked = visible.length > 0 && checkedVisible === visible.length;
		this.selectAllBox.indeterminate = checkedVisible > 0 && checkedVisible < visible.length;
		this.selectAllBox.disabled = visible.length === 0;
		this.selectAllLabel.setText(`${t("modal.reset_overrides.select_all")} (${visible.length})`);
	}

	/**
	 * Remove button counts every selected entry, including hidden ones, so a
	 * search filter does not silently understate what the button will delete.
	 */
	private refreshRemoveButton(): void
	{
		if (!this.removeBtn) return;
		const count = this.rows.filter((r) => r.checkbox.checked).length;
		this.removeBtn.setText(t("modal.reset_overrides.remove", { count }));
		this.removeBtn.disabled = count === 0;
	}
}
