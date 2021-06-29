// import react
import React from 'react';

// offline page
const OfflinePage = (props = {}) => {

  // return jsx
  return (
    <section className="jumbotron jumbotron-offline text-center d-flex flex-1 align-items-center">
      <div className="w-100">
        <h1>
          This page is not available offline.
        </h1>
      </div>
    </section>
  );
};

// offline page
export default OfflinePage;