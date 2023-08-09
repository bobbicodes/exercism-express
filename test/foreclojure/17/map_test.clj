(deftest map-test
  (is (= l (map #(+ % 5) '(1 2 3))))