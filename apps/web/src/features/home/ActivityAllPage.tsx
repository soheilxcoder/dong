import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Activity } from '@dong/core';
import { useStore } from '@/app/store';
import { Empty, PageHeader } from '@/design-system/ui';
import { ActivityList } from '@/features/groups/ActivityList';
import { PendingForMe } from '@/features/settlements/PendingForMe';

export function ActivityAllPage() {
  const { adapter, groups } = useStore();
  const [items, setItems] = useState<(Activity & { groupName: string; groupId: string })[]>([]);
  useEffect(() => {
    (async () => {
      const all = await Promise.all(groups.map(async (g) => (await adapter.activity(g.group.id)).map((a) => ({ ...a, groupName: g.group.name }))));
      setItems(all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100));
    })();
  }, [groups, adapter]);
  return (
    <div className="safe-b">
      <PageHeader title="فعالیت‌ها" back={false} />
      <div className="px-5 pt-2">
        <PendingForMe />
        {items.length === 0 ? <Empty mood="waiting" title="هنوز خبری نیست" text="وقتی هزینه‌ای ثبت یا پرداختی انجام بشه، اینجا می‌بینی." /> : (
          <ActivityList items={items} renderGroup={(a) => <Link to={`/g/${a.groupId}`} className="text-brand text-xs font-bold">{(a as typeof items[number]).groupName}</Link>} />
        )}
      </div>
    </div>
  );
}
