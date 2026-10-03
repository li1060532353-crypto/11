import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSelect } from './ThemeSelect';
const options = [{ value: '', label: 'All' }, { value: 'embedded', label: 'Embedded' }, { value: 'math', label: 'Math' }];
describe('ThemeSelect', () => {
  it('selects with keyboard and returns focus to the trigger', async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<ThemeSelect label="Category" value="" options={options} onChange={onChange} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger); await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('embedded');
    expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('exposes selected state and closes on Escape without changing selection', async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<ThemeSelect label="Category" value="math" options={options} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Math' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('selects by pointer and dismisses when focus leaves', async () => {
    const onChange = vi.fn(); const user = userEvent.setup();
    render(<><ThemeSelect label="Category" value="" options={options} onChange={onChange} /><button>Outside</button></>);
    await user.click(screen.getByRole('combobox')); await user.click(screen.getByRole('option', { name: 'Math' }));
    expect(onChange).toHaveBeenCalledWith('math');
    await user.click(screen.getByRole('combobox')); await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
