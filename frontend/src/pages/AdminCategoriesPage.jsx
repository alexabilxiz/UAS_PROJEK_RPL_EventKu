import { useState } from 'react';
import WorkspacePage from '../components/WorkspacePage';
import { useWorkspaceList } from '../hooks/useWorkspaceList';
import { CATEGORY_NAME_LIMIT, workspaceService } from '../services/workspaceService';

function CategoryForm({ category, busy, onSave, onCancel }) {
  const [name, setName] = useState(category?.name ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  return <form className="workspace-stack" onSubmit={async (event) => {
    event.preventDefault();
    if (name.trim() && await onSave({ name: name.trim(), isActive }) && !category) setName('');
  }}>
    <label className="workspace-field">Nama kategori
      <input required maxLength={CATEGORY_NAME_LIMIT} value={name} disabled={busy}
        onChange={(event) => setName(event.target.value)} />
    </label>
    {category && <label className="workspace-checkbox">
      <input type="checkbox" checked={isActive} disabled={busy} onChange={(event) => setIsActive(event.target.checked)} />
      Aktif untuk event baru dan filter katalog
    </label>}
    <div className="workspace-actions">
      <button className="primary-button" type="submit" disabled={busy || !name.trim()}>
        {category ? 'Simpan perubahan' : 'Tambah kategori'}
      </button>
      {category && <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>Batal</button>}
    </div>
  </form>;
}

export default function AdminCategoriesPage() {
  const list = useWorkspaceList(workspaceService.categories);
  const [editing, setEditing] = useState(null);
  const categories = list.result?.data ?? [];

  async function save(categoryId, values) {
    const success = await list.run(
      (options) => workspaceService.saveCategory(categoryId, values, options),
      categoryId ? 'Perubahan kategori disimpan.' : 'Kategori baru ditambahkan.',
    );
    if (success) setEditing(null);
    return success;
  }

  return <WorkspacePage title="Kategori event" backTo="/admin" backLabel="Kembali ke ruang admin" list={list}>
    <div className="workspace-card workspace-stack">
      <h2>Tambah kategori</h2>
      <CategoryForm busy={list.busy} onSave={(values) => save(null, values)} />
    </div>
    {categories.length ? <ul className="workspace-list workspace-section">
      {categories.map((category) => <li className="workspace-card workspace-stack" key={category.categoryId}>
        <div className="workspace-row">
          <h2>{category.name}</h2>
          <div className="workspace-actions">
            <span className="workspace-badge">{category.isActive ? 'Aktif' : 'Nonaktif'}</span>
            {editing !== category.categoryId && <button className="secondary-button" type="button" disabled={list.busy}
              onClick={() => setEditing(category.categoryId)}>Ubah</button>}
          </div>
        </div>
        {editing === category.categoryId && <CategoryForm category={category} busy={list.busy}
          onSave={(values) => save(category.categoryId, values)} onCancel={() => setEditing(null)} />}
      </li>)}
    </ul> : <p className="workspace-section">Belum ada kategori.</p>}
  </WorkspacePage>;
}
