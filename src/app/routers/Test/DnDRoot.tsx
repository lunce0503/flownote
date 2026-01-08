import React, {useState} from 'react';
import { DndContext,useDraggable,useDroppable, type DragEndEvent } from '@dnd-kit/core';
import {CSS} from '@dnd-kit/utilities'
interface DraggableItemProps {
  id: string | number;
  children: React.ReactNode;
}

function DraggableItem({ id, children }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
  });

  const style: React.CSSProperties = {
    // CSS.Translate.toString을 사용하면 성능과 호환성이 더 좋습니다.
    transform: CSS.Translate.toString(transform),
    padding: '10px',
    margin: '5px',
    background: '#f4f4f4',
    borderRadius: '5px',
    border: '1px solid #ddd',
    cursor: 'grab',
  };

  return (
    <div className='text-black'ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

interface DroppableAreaProps {
  id: string;
  children: React.ReactNode;
}

function DroppableArea({ id, children }: DroppableAreaProps) {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  const style: React.CSSProperties = {
    padding: '20px',
    border: '2px dashed #ccc',
    minHeight: '100px',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}

const DndRoot = () => {
  const [items, setItems] = useState(["Item 1", "Item 2"])
  const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

    // 드롭된 위치(over)가 있고, 원래 위치와 다를 때만 실행
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);

        // 단순 순서 변경 로직 (실제 서비스에선 arrayMove 함수 사용 권장)
        const newItems = [...prev];
        const [movedItem] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, movedItem);
        
        return newItems;
      });
    }
  };
  
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <DroppableArea id="drop-zone">
        {items.map((item, index) => (
          <DraggableItem key={index} id={index}>
            {item}  
          </DraggableItem>
        ))}
      </DroppableArea>
    </DndContext>
  )
}

export default DndRoot

