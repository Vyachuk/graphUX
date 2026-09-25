import { getCity, getCompany, getRestaurant, people } from '../data';
import { sameRef, useNav } from '../navigation';

export function PeopleTable() {
  const { open, openedChildren } = useNav();

  return (
    <div className="table-wrap nowheel">
      <table className="table">
        <thead>
          <tr>
            <th>Ім'я</th>
            <th>Роль</th>
            <th>Компанія</th>
            <th>Місто</th>
            <th>Улюблений ресторан</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const ref = { type: 'person', id: p.id } as const;
            const active = openedChildren.some((r) => sameRef(r, ref));
            return (
              <tr
                key={p.id}
                className={`nodrag${active ? ' is-active' : ''}`}
                onClick={() => open(ref, 'row')}
              >
                <td className="table__name">{p.name}</td>
                <td>{p.role}</td>
                <td>{getCompany(p.companyId).name}</td>
                <td>{getCity(p.cityId).name}</td>
                <td>{getRestaurant(p.favoriteRestaurantId).name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
