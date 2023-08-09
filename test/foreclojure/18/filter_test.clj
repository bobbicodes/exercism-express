(deftest filter-test
  (is (= l (filter #(> % 5) '(3 4 5 6 7)))))