          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Navn</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mål</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Forbruk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visninger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klikk</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konverteringer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Omsetning</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns && campaigns.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(c.status)}`}>{c.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{c.objective}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(c.spend)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatNumber(c.impressions)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatNumber(c.clicks)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatNumber(c.conversions)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(c.purchaseValue)}</td>
                <td className={`px-6 py-4 whitespace-nowrap ${getROASColor(c.roas)}`}>{c.roas ? c.roas.toFixed(2) : '-'}</td>
              </tr>
            ))}
          </tbody> 